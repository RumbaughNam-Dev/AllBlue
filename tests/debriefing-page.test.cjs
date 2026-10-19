const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadModule}=require('./helpers.cjs');
const {loadDebriefingPage}=loadModule('utils/debriefingPage.ts',{});
test('blank, whitespace, null and missing notes are hidden; real notes remain',async()=>{
 const result=await loadDebriefingPage(async()=>({debriefings:[{content:''},{content:' \n\t '},{content:null},{},{id:5,content:' 피드백 '}],hasMore:false}),1);
 assert.equal(result.debriefings.length,1);assert.equal(result.debriefings[0].id,5);
});
test('skip blank-only pages and preserve the server cursor for the next fetch',async()=>{
 const calls=[];
 const result=await loadDebriefingPage(async page=>{calls.push(page);return {debriefings:[{content:page===4?'실제 디브리핑':'\n'}],hasMore:true};},2);
 assert.deepEqual(calls,[2,3,4]);assert.equal(result.page,4);assert.equal(result.hasMore,true);
});
test('all blank history ends at the last page instead of showing placeholder cards',async()=>{
 const result=await loadDebriefingPage(async page=>({debriefings:[{content:''}],hasMore:page<3}),1);
 assert.equal(result.debriefings.length,0);assert.equal(result.hasMore,false);assert.equal(result.page,3);
});
test('network failures propagate instead of being shown as an empty history',async()=>{
 await assert.rejects(()=>loadDebriefingPage(async()=>{throw Error('network')},1),/network/);
});
