import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';

function fakeDb(changes:number) {
  let sql='';
  let args:unknown[]=[];
  const DB={
    prepare(query:string) {
      sql=query;
      return {
        bind(...values:unknown[]) {
          args=values;
          return {run:async()=>({meta:{changes}})};
        }
      };
    }
  } as unknown as D1Database;
  return {DB,statement:()=>sql,bindings:()=>args};
}

const registration={
  client_name:'Test client',
  redirect_uris:['https://client.example/callback'],
  token_endpoint_auth_method:'none'
};
async function register(DB:D1Database) {
  return handleOAuth(new Request('https://hub.example/oauth/register',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(registration)
  }),{DB,MEMORY_API_TOKEN:'test-owner-secret'});
}

test('OAuth registration is limited by an atomic conditional insert',async()=>{
  const db=fakeDb(1);
  const response=await register(db.DB);
  assert.equal(response?.status,201);
  assert.match(db.statement(),/INSERT INTO oauth_clients/i);
  assert.match(db.statement(),/SELECT COUNT\(\*\) FROM oauth_clients/i);
  assert.match(db.statement(),/< 100/);
  assert.match(db.statement(),/created_at >= \?/);
  assert.match(db.statement(),/< 10/);
  assert.equal(db.bindings().length,5);
  assert.ok(Date.parse(String(db.bindings()[4])) <= Date.now());
  assert.equal(db.bindings()[1],'Test client');
  assert.deepEqual(JSON.parse(String(db.bindings()[2])),registration.redirect_uris);
  const body=await response?.json() as {client_id:string};
  assert.ok(body.client_id);
});

test('OAuth registration rejects full quota without issuing a client ID',async()=>{
  const db=fakeDb(0);
  const response=await register(db.DB);
  assert.equal(response?.status,429);
  assert.deepEqual(await response?.json(),{
    error:'invalid_client_metadata',error_description:'Client registration limit reached; retry later or ask the owner to review clients'
  });
  assert.match(db.statement(),/WHERE \(SELECT COUNT\(\*\) FROM oauth_clients\) < 100/);
  assert.match(db.statement(),/AND \(SELECT COUNT\(\*\) FROM oauth_clients WHERE created_at >= \?\) < 10/);
});


test('registration window is anchored one hour before creation',async()=>{
  const db=fakeDb(1);
  const before=Date.now();
  await register(db.DB);
  const after=Date.now();
  const created=Date.parse(String(db.bindings()[3]));
  const cutoff=Date.parse(String(db.bindings()[4]));
  assert.ok(created>=before && created<=after);
  assert.ok(cutoff>=before-3600000 && cutoff<=after-3600000);
  assert.equal(created-cutoff,3600000);
});
