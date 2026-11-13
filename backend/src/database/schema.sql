CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL,
  age INT CHECK (age IS NULL OR age BETWEEN 1 AND 120),
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
  home_city VARCHAR(100),
  home_airport VARCHAR(10),
  gender_preference VARCHAR(20) NOT NULL DEFAULT 'ANY'
    CHECK (gender_preference IN ('ANY', 'SAME_GENDER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interests (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(150) NOT NULL,
  category VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS user_interests (
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id VARCHAR(50) NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, interest_id)
);

CREATE TABLE IF NOT EXISTS destinations (
  id SERIAL PRIMARY KEY,
  city VARCHAR(100) UNIQUE NOT NULL,
  country VARCHAR(100) NOT NULL,
  timezone VARCHAR(100),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', city || ' ' || country)
  ) STORED
);

CREATE INDEX IF NOT EXISTS destinations_search_idx
  ON destinations USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS destinations_trgm_idx
  ON destinations USING GIN(city gin_trgm_ops);

CREATE TABLE IF NOT EXISTS hotels (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  city VARCHAR(100) NOT NULL REFERENCES destinations(city),
  area VARCHAR(100),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  rating NUMERIC(3, 1),
  stars INT,
  check_in_from TIME,
  check_out_until TIME,
  family_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(50) PRIMARY KEY,
  hotel_id VARCHAR(50) NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_type VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  max_adults INT NOT NULL,
  max_children INT NOT NULL DEFAULT 0,
  price_amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  refundable BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS availability (
  room_id VARCHAR(50) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  stay_date DATE NOT NULL,
  rooms_left INT NOT NULL CHECK (rooms_left >= 0),
  PRIMARY KEY (room_id, stay_date)
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(50) UNIQUE,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('creator', 'seeker')),
  destination VARCHAR(100) NOT NULL REFERENCES destinations(city),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  budget_inr INTEGER NOT NULL CHECK (budget_inr > 0),
  itinerary TEXT,
  gender_preference VARCHAR(20) CHECK (gender_preference IN ('ANY', 'SAME_GENDER')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (check_out > check_in)
);

-- Trip-level preference keeps seeded trips intact while letting each new trip choose separately.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS gender_preference VARCHAR(20)
  CHECK (gender_preference IN ('ANY', 'SAME_GENDER'));

CREATE INDEX IF NOT EXISTS trips_date_idx
  ON trips(check_in, check_out);

CREATE INDEX IF NOT EXISTS trips_destination_idx
  ON trips(destination);

CREATE OR REPLACE FUNCTION prevent_opposite_role_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM trips
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND role <> NEW.role
      AND (NEW.id IS NULL OR id <> NEW.id)
      AND daterange(check_in, check_out, '[)')
          && daterange(NEW.check_in, NEW.check_out, '[)')
  ) THEN
    RAISE EXCEPTION
      'A user cannot be a creator and seeker during overlapping dates';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trips_opposite_role_overlap_trigger ON trips;

CREATE TRIGGER trips_opposite_role_overlap_trigger
BEFORE INSERT OR UPDATE OF user_id, role, check_in, check_out, status ON trips
FOR EACH ROW
EXECUTE FUNCTION prevent_opposite_role_overlap();

CREATE TABLE IF NOT EXISTS trip_interests (
  trip_id INT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  interest_id VARCHAR(50) NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, interest_id)
);

CREATE TABLE IF NOT EXISTS groups (
  id VARCHAR(50) PRIMARY KEY,
  trip_id INT UNIQUE NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  owner_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  max_size INT NOT NULL CHECK (max_size BETWEEN 1 AND 20),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'FULL', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id VARCHAR(50) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS join_requests (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(50) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  seeker_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by VARCHAR(50) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  UNIQUE (group_id, seeker_id)
);

CREATE TABLE IF NOT EXISTS saved_hotels (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(50) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hotel_id VARCHAR(50) NOT NULL REFERENCES hotels(id),
  room_id VARCHAR(50) NOT NULL REFERENCES rooms(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, user_id, room_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  group_id VARCHAR(50) UNIQUE NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  hotel_id VARCHAR(50) NOT NULL REFERENCES hotels(id),
  room_id VARCHAR(50) NOT NULL REFERENCES rooms(id),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  room_count INT NOT NULL,
  total_cost_inr INTEGER NOT NULL,
  cost_per_member_inr INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Records the group's agreed stay choice; this does not create a hotel reservation.
CREATE TABLE IF NOT EXISTS finalized_stays (
  id BIGSERIAL PRIMARY KEY,
  group_id VARCHAR(50) UNIQUE NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  hotel_id VARCHAR(50) NOT NULL REFERENCES hotels(id),
  room_id VARCHAR(50) NOT NULL REFERENCES rooms(id),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  room_count INT NOT NULL,
  total_cost_inr INTEGER NOT NULL,
  cost_per_member_inr INTEGER NOT NULL,
  finalized_by VARCHAR(50) NOT NULL REFERENCES users(id),
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (check_out > check_in)
);

CREATE TABLE IF NOT EXISTS group_finalization_status (
  group_id VARCHAR(50) PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'unfinalized'
    CHECK (status IN ('finalized', 'unfinalized')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO group_finalization_status(group_id,status)
SELECT g.id,CASE WHEN fs.group_id IS NULL THEN 'unfinalized' ELSE 'finalized' END
FROM groups g LEFT JOIN finalized_stays fs ON fs.group_id=g.id
ON CONFLICT (group_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS group_member_expenses (
  group_id VARCHAR(50) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expenditure_inr INTEGER NOT NULL CHECK (expenditure_inr >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_room_recommendations (
  group_id VARCHAR(50) PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  room_id VARCHAR(50) NOT NULL REFERENCES rooms(id),
  recommended_by VARCHAR(50) NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'COMPLETED')),
  response_status INT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  UNIQUE(user_id, idempotency_key)
);
