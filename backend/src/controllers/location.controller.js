const service=require('../services/location.service');
async function search(req,res,next){try{res.json(await service.search(String(req.query.q||'').trim()));}catch(e){next(e);}}
module.exports={search};
