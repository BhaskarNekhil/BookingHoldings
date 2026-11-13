const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const service = require("../services/auth.service");
const { createToken } = require("../utils/auth");
async function signup(req, res, next) {
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
    if (!email || !name || !password || !gender)
      return res
        .status(400)
        .json({ message: "email, name, password and gender are required" });
    const id = `U-${crypto.randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await service.createUser(
      { id, email, name, age, gender, homeCity, homeAirport, genderPreference },
      passwordHash,
      { interests },
    );
    res.status(201).json({ user, token: createToken(user) });
  } catch (e) {
    if (e.code === "23505")
      return res.status(409).json({ message: "Email already exists" });
    next(e);
  }
}
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await service.findByEmail(email || "");
    if (!user || !(await bcrypt.compare(password || "", user.password_hash)))
      return res.status(401).json({ message: "Invalid email or password" });
    delete user.password_hash;
    res.json({ user, token: createToken(user) });
  } catch (e) {
    next(e);
  }
}
module.exports = { signup, login };
