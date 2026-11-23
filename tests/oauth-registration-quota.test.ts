import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOAuth } from '../src/oauth';

function fakeDb(changes:number, throttleChanges=1) {
  let sql='';
  let args:unknown[]=[];
  let throttleSql='';
  let throttleCalls=0;
  const DB={
    prepare(query:string) {
      if(query.includes("VALUES ('client_registration'")){throttleSql=query;throttleCalls++;}else{sql=query;}
      return {
        bind(...values:unknown[]) {
          if(!query.includes("VALUES ('client_registration'"))args=values;
          return {run:async()=>({meta:{changes:query.includes("VALUES ('client_registration'") ? throttleChanges : changes}})};
        }
      };
    }
  } as unknown as D1Database;
  return {DB,statement:()=>sql,bindings:()=>args,throttleSql:()=>throttleSql,throttleCalls:()=>throttleCalls};
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

test('invalid registration metadata still consumes the D1 request quota',async()=>{
  const db=fakeDb(1);
  const response=await handleOAuth(new Request('https://hub.example/oauth/register',{
    method:'POST',headers:{'content-type':'application/json'},body:'{"redirect_uris":[]}'
  }),{DB:db.DB,MEMORY_API_TOKEN:'test-owner-secret'});
  assert.equal(response?.status,400);
  assert.equal(db.throttleCalls(),1);
  assert.match(db.throttleSql(),/VALUES \('client_registration',\?,1\)/);
  assert.match(db.throttleSql(),/ON CONFLICT\(name\) DO UPDATE/);
  assert.match(db.throttleSql(),/attempts < 100/);
});

test('registration request quota rejects before parsing client metadata',async()=>{
  const db=fakeDb(0,0);
  const response=await handleOAuth(new Request('https://hub.example/oauth/register',{
    method:'POST',headers:{'content-type':'application/json'},body:'not-json'
  }),{DB:db.DB,MEMORY_API_TOKEN:'test-owner-secret'});
  assert.equal(response?.status,429);
  assert.equal(db.throttleCalls(),1);
  assert.equal(db.statement(),'');
  assert.equal((await response?.json() as {error:string}).error,'slow_down');
});
