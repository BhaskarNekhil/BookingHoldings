const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../config/db");

async function runSchema() {
  const client = await pool.connect();

  try {
    const schema = await fs.readFile(
      path.join(__dirname, "schema.sql"),
      "utf8"
    );

    await client.query(schema);
    console.log("Database schema is ready.");
  } catch (error) {
    console.error("Schema creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runSchema();
