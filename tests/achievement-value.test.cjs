const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadModule}=require('./helpers.cjs');
const {parseAchievementValue:parse,achievementValueText:format}=loadModule('utils/achievementValue.ts',{});
test('STA preserves minutes and seconds, including single-digit seconds',()=>{
 assert.equal(parse('4:1','SEC'),241);
 assert.equal(format(241,'SEC'),'4:01');
 assert.equal(parse('0:0','SEC'),0);
 assert.equal(parse('99:59','SEC'),5999);
 for(const value of ['4.1','4:60','-1:00','100:00'])assert.throws(()=>parse(value,'SEC'));
});
test('distances accept decimals and explicit zero; blank clears only the value',()=>{
 assert.equal(parse('30.25','METER'),30.25);
 assert.equal(parse('0','METER'),0);
 assert.equal(parse('  ','METER'),null);
 assert.equal(format(null,'METER'),'');
 for(const value of ['-1','1.234','Infinity','1e3','100000','NaN'])assert.throws(()=>parse(value,'METER'));
});
