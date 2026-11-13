const crypto = require("node:crypto");
const pool = require("../config/db");

module.exports = async function idempotency(req, res, next) {
  const key = req.get("Idempotency-Key");
  if (!key)
    return res
      .status(400)
      .json({ message: "Idempotency-Key header is required" });
  if (key.length > 200)
    return res.status(400).json({ message: "Idempotency-Key is too long" });

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(req.body || {}))
    .digest("hex");
  const actorId =
    req.user?.userId ||
    `email:${String(req.body?.email || "")
      .trim()
      .toLowerCase()}`;
  if (actorId === "email:")
    return res
      .status(400)
      .json({ message: "Email is required for an idempotent auth request" });
  try {
    const inserted = await pool.query(
      `INSERT INTO idempotency_keys
      (user_id,idempotency_key,request_hash,status)
      VALUES ($1,$2,$3,'PROCESSING') ON CONFLICT (user_id,idempotency_key) DO NOTHING
      RETURNING id`,
      [actorId, key, hash],
    );

    if (!inserted.rowCount) {
      const previous = await pool.query(
        `SELECT request_hash,status,response_status,response_body
        FROM idempotency_keys WHERE user_id=$1 AND idempotency_key=$2`,
        [actorId, key],
      );
      const record = previous.rows[0];
      if (record.request_hash !== hash)
        return res
          .status(409)
          .json({
            message:
              "Idempotency-Key was already used with a different request",
          });
      if (record.status === "COMPLETED")
        return res.status(record.response_status).json(record.response_body);
      return res
        .status(409)
        .json({
          message:
            "This request is already being processed; retry with the same key",
        });
    }

    const id = inserted.rows[0].id;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode;
      if (status >= 500) {
        pool
          .query("DELETE FROM idempotency_keys WHERE id=$1", [id])
          .catch(() => {});
      } else {
        pool
          .query(
            `UPDATE idempotency_keys SET status='COMPLETED',response_status=$2,
          response_body=$3::jsonb WHERE id=$1`,
            [id, status, JSON.stringify(body)],
          )
          .catch(() => {});
      }
      return originalJson(body);
    };
    next();
  } catch (error) {
    next(error);
  }
};
