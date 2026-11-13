const service=require('../services/trip.service');
async function createTrip(req,res,next){
  try {
    const {role,destination,checkIn,checkOut,budgetInr,interests=[],itinerary=null}=req.body;
    if(!['creator','seeker'].includes(role))return res.status(400).json({message:'role must be creator or seeker'});
    const trip=await service.createTrip(req.user.userId,{role,destination,checkIn,checkOut,budgetInr,interests,itinerary});
    return res.status(201).json({trip});
  }catch(e){next(e);}
}
module.exports={createTrip};
