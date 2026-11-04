import test from 'node:test';
import assert from 'node:assert/strict';
import {authorized,safeLimit,validateMemoryInput,validId} from '../src/domain';
test('rejects unconfigured tokens',()=>{
 assert.equal(authorized('Bearer test','REPLACE_WITH_SECRET_123456789012345678'),false);
 assert.equal(authorized(null,'a'.repeat(40)),false);
 assert.equal(authorized('Bearer wrong','a'.repeat(40)),false);
 assert.equal(authorized('Bearer '+'a'.repeat(40),'a'.repeat(40)),true);
});
test('validates proposed memory',()=>{
 assert.equal(validateMemoryInput({title:'Project',body:'Built a system',category:'project',source:'user statement'}).ok,true);
 assert.equal(validateMemoryInput({title:'',body:'x',category:'project',source:'user'}).ok,false);
 assert.equal(validateMemoryInput({title:'x',body:'x',category:'admin',source:'user'}).ok,false);
 assert.equal(validateMemoryInput({title:'x',body:'x',category:'skill',source:''}).ok,false);
});
test('limits queries and checks ids',()=>{
 assert.equal(safeLimit('1000'),100);
 assert.equal(safeLimit('abc'),25);
 assert.equal(safeLimit('-5'),1);
 assert.equal(validId('not-an-id'),false);
 assert.equal(validId('530bbc97-9769-4d4e-8e35-091817cbff45'),true);
});
