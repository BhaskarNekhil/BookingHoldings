const service=require('../services/hotel.service');
async function list(req,res,next){try{const result=await service.list(req.params.groupId,req.user.userId);if(!result)return res.status(404).json({message:'Group not found or access denied'});res.json(result);}catch(e){next(e);}}
module.exports={list};
