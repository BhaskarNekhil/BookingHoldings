const pool=require('../config/db');
async function createTrip(userId,input){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const city=await client.query('SELECT city FROM destinations WHERE city=$1',[input.destination]);
    if(!city.rowCount){const e=new Error('Select a valid destination');e.statusCode=400;throw e;}
    const result=await client.query(`INSERT INTO trips(user_id,role,destination,check_in,check_out,budget_inr,itinerary)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[userId,input.role,input.destination,input.checkIn,input.checkOut,input.budgetInr,input.itinerary]);
    for(const interest of input.interests)await client.query('INSERT INTO trip_interests(trip_id,interest_id) VALUES($1,$2)',[result.rows[0].id,interest]);
    await client.query('COMMIT');return result.rows[0];
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
module.exports={createTrip};
