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
    error:'invalid_client_metadata',error_description:'Client registration quota reached'
  });
  assert.match(db.statement(),/WHERE \(SELECT COUNT\(\*\) FROM oauth_clients\) < 100/);
});
