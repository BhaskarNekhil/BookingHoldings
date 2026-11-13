const pool=require('../config/db');
async function search(q){
 if(q.length<2)return [];
 const result=await pool.query(`SELECT city,country,timezone,
 ts_rank(search_vector,plainto_tsquery('simple',$1)) AS text_score,
 similarity(city,$1) AS fuzzy_score FROM destinations
 WHERE search_vector @@ plainto_tsquery('simple',$1) OR similarity(city,$1)>=0.20
 ORDER BY GREATEST(ts_rank(search_vector,plainto_tsquery('simple',$1)),similarity(city,$1)) DESC LIMIT 10`,[q]);
 return result.rows;
}
module.exports={search};
