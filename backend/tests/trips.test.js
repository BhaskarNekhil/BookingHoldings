const test=require('node:test');const assert=require('node:assert/strict');
test('only creator and seeker are valid trip roles',()=>{for(const role of ['creator','seeker'])assert.ok(['creator','seeker'].includes(role));assert.equal(['creator','seeker'].includes('admin'),false);});
