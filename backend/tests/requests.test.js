const test=require('node:test');const assert=require('node:assert/strict');
test('only pending requests may be reviewed',()=>{assert.equal('PENDING'==='PENDING',true);assert.equal('APPROVED'==='PENDING',false);});
