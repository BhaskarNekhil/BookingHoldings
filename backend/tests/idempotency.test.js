const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
test('idempotency request fingerprint is stable for identical JSON bodies',()=>{
 const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');assert.equal(hash({city:'Kyoto',budget:60000}),hash({city:'Kyoto',budget:60000}));assert.notEqual(hash({city:'Kyoto'}),hash({city:'Osaka'}));
});
