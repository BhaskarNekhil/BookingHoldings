const fs = require("node:fs/promises");
const path = require("node:path");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const DATA_DIR = path.join(__dirname, "../../../hackathon-problem-3-group-travel-matcher/data");
const DEFAULT_PASSWORD = "Password@123";

async function readJson(relativePath) {
  const file = await fs.readFile(path.join(DATA_DIR, relativePath), "utf8");
  return JSON.parse(file);
}

async function seedInterests(client) {
  const interests = await readJson("problem-3/interests.json");

  for (const item of interests) {
    await client.query(
      `
      INSERT INTO interests (id, label, category)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        category = EXCLUDED.category
      `,
      [item.interest, item.label, item.category]
    );
  }
}

async function seedDestinations(client) {
  const catalog = await readJson("catalog/destinations.json");

  for (const country of catalog.countries) {
    for (const city of country.cities) {
      await client.query(
        `
        INSERT INTO destinations (city, country, timezone)
        VALUES ($1, $2, $3)
        ON CONFLICT (city) DO UPDATE SET
          country = EXCLUDED.country,
          timezone = EXCLUDED.timezone
        `,
        [city.name, country.name, country.timezone]
      );
    }
  }
}

async function seedHotels(client) {
  const hotels = await readJson("catalog/hotels.json");

  for (const hotel of hotels) {
    await client.query(
      `
      INSERT INTO hotels (
        id, name, aliases, city, area, latitude, longitude, rating,
        stars, check_in_from, check_out_until, family_friendly, image
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        aliases = EXCLUDED.aliases,
        city = EXCLUDED.city,
        area = EXCLUDED.area,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        rating = EXCLUDED.rating,
        stars = EXCLUDED.stars,
        check_in_from = EXCLUDED.check_in_from,
        check_out_until = EXCLUDED.check_out_until,
        family_friendly = EXCLUDED.family_friendly,
        image = EXCLUDED.image
      `,
      [
        hotel.hotel_id,
        hotel.name,
        JSON.stringify(hotel.aliases || []),
        hotel.city,
        hotel.area,
        hotel.lat,
        hotel.lng,
        hotel.rating,
        hotel.stars,
        hotel.check_in_from,
        hotel.check_out_until,
        hotel.family_friendly,
        hotel.image,
      ]
    );
  }
}

async function seedRooms(client) {
  const rooms = await readJson("catalog/rooms.json");

  for (const room of rooms) {
    await client.query(
      `
      INSERT INTO rooms (
        id, hotel_id, room_type, name, max_adults, max_children,
        price_amount, currency, refundable
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        hotel_id = EXCLUDED.hotel_id,
        room_type = EXCLUDED.room_type,
        name = EXCLUDED.name,
        max_adults = EXCLUDED.max_adults,
        max_children = EXCLUDED.max_children,
        price_amount = EXCLUDED.price_amount,
        currency = EXCLUDED.currency,
        refundable = EXCLUDED.refundable
      `,
      [
        room.room_id,
        room.hotel_id,
        room.room_type,
        room.name,
        room.max_adults,
        room.max_children,
        room.price_per_night.amount,
        room.price_per_night.currency,
        room.refundable,
      ]
    );
  }
}

async function seedAvailability(client) {
  const availability = await readJson("catalog/availability.json");

  for (const item of availability) {
    await client.query(
      `
      INSERT INTO availability (room_id, stay_date, rooms_left)
      VALUES ($1, $2, $3)
      ON CONFLICT (room_id, stay_date) DO UPDATE SET
        rooms_left = EXCLUDED.rooms_left
      `,
      [item.room_id, item.date, item.rooms_left]
    );
  }
}

async function seedUsers(client, passwordHash) {
  const travellers = await readJson("problem-3/travellers.json");

  for (const traveller of travellers) {
    const email = `${traveller.traveller_id.toLowerCase()}@seed.local`;

    await client.query(
      `
      INSERT INTO users (
        id, email, name, password_hash, age, gender,
        home_city, home_airport, gender_preference
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        age = EXCLUDED.age,
        gender = EXCLUDED.gender,
        home_city = EXCLUDED.home_city,
        home_airport = EXCLUDED.home_airport,
        gender_preference = EXCLUDED.gender_preference
      `,
      [
        traveller.traveller_id,
        email,
        traveller.name,
        passwordHash,
        traveller.age,
        traveller.gender,
        traveller.home_city,
        traveller.home_airport,
        traveller.gender_preference,
      ]
    );

    for (const interestId of traveller.interests) {
      await client.query(
        `
        INSERT INTO user_interests (user_id, interest_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [traveller.traveller_id, interestId]
      );
    }
  }
}

async function seedGroups(client) {
  const groups = await readJson("problem-3/groups.json");

  for (const group of groups) {
    const tripResult = await client.query(
      `
      INSERT INTO trips (
        external_id, user_id, role, destination,
        check_in, check_out, budget_inr, itinerary
      )
      VALUES ($1, $2, 'creator', $3, $4, $5, $6, $7)
      ON CONFLICT (external_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        destination = EXCLUDED.destination,
        check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        budget_inr = EXCLUDED.budget_inr,
        itinerary = EXCLUDED.itinerary
      RETURNING id
      `,
      [
        group.group_id,
        group.owner_id,
        group.city,
        group.check_in,
        group.check_out,
        group.budget_inr,
        group.itinerary,
      ]
    );

    const tripId = tripResult.rows[0].id;

    await client.query(
      `
      INSERT INTO groups (id, trip_id, owner_id, name, max_size)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        trip_id = EXCLUDED.trip_id,
        owner_id = EXCLUDED.owner_id,
        name = EXCLUDED.name,
        max_size = EXCLUDED.max_size
      `,
      [group.group_id, tripId, group.owner_id, group.name, group.max_size]
    );

    for (const memberId of group.member_ids) {
      await client.query(
        `
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [group.group_id, memberId]
      );
    }
  }
}

async function seed() {
  const client = await pool.connect();

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    await client.query("BEGIN");
    await seedInterests(client);
    await seedDestinations(client);
    await seedHotels(client);
    await seedRooms(client);
    await seedAvailability(client);
    await seedUsers(client, passwordHash);
    await seedGroups(client);
    await client.query("COMMIT");

    console.log("JSON seeding completed successfully.");
    console.log(`Seeded users use password: ${DEFAULT_PASSWORD}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("JSON seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
