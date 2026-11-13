const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const express = require("express");
const pool = require("../config/db");
const { createToken } = require("../utils/auth");

const router = express.Router();

router.post("/signup", async (req, res, next) => {
  try {
    const {
      email,
      name,
      password,
      age,
      gender,
      homeCity,
      homeAirport,
      genderPreference = "ANY",
      interests = [],
    } = req.body;

    if (!email || !name || !password || !gender) {
      return res.status(400).json({
        message: "email, name, password and gender are required",
      });
    }

    const userId = `U-${crypto.randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        INSERT INTO users (
          id, email, name, password_hash, age, gender,
          home_city, home_airport, gender_preference
        )
        VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, email, name, age, gender, home_city, home_airport,
                  gender_preference
        `,
        [
          userId,
          email,
          name,
          passwordHash,
          age || null,
          gender,
          homeCity || null,
          homeAirport || null,
          genderPreference,
        ]
      );

      for (const interestId of interests) {
        await client.query(
          `
          INSERT INTO user_interests (user_id, interest_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [userId, interestId]
        );
      }

      await client.query("COMMIT");
      const user = result.rows[0];

      return res.status(201).json({ user, token: createToken(user) });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        return res.status(409).json({ message: "Email already exists" });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `
      SELECT id, email, name, password_hash, age, gender,
             home_city, home_airport, gender_preference
      FROM users
      WHERE email = LOWER($1)
      `,
      [email]
    );

    const user = result.rows[0];
    const valid = user && (await bcrypt.compare(password || "", user.password_hash));

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    delete user.password_hash;
    return res.json({ user, token: createToken(user) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
