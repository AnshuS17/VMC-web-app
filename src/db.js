const fs = require("fs");
const { hashPassword, verifyPassword } = require("./auth.js");
const { DATA_DIR, DB_FILE, DATABASE_URL, MONGODB_URI, MONGODB_DB, SEED_USERS } = require("./config.js");

let pgPool;
let mongoClient;
let mongoReady = false;
let databaseReady = false;

function publicUser(user) {
  return {
    email: user.email,
    role: user.role,
    name: user.name
  };
}

function seedUsers() {
  return SEED_USERS.map((user) => ({
    email: user.email.toLowerCase(),
    passwordHash: hashPassword(user.password),
    role: user.role,
    name: user.name,
    createdAt: new Date().toISOString()
  }));
}

function seedComplaints() {
  const now = Date.now();
  return [
    {
      id: "VMC-1001",
      serviceType: "garbage",
      title: "Garbage pile near Akota Garden",
      description: "Garbage bags have been left near the footpath for two days.",
      location: "Akota Garden Road",
      ward: "Ward 10",
      citizenName: "M. Patel",
      phone: "9876543210",
      latitude: 22.2939,
      longitude: 73.1645,
      status: "In Progress",
      priority: "Medium",
      createdAt: new Date(now - 1000 * 60 * 60 * 7).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString()
    },
    {
      id: "VMC-1002",
      serviceType: "waterlogging",
      title: "Water logging at Alkapuri underpass",
      description: "Traffic is slowing because rain water is not draining.",
      location: "Alkapuri Underpass",
      ward: "Ward 7",
      citizenName: "A. Shah",
      phone: "9123456780",
      latitude: 22.3122,
      longitude: 73.1687,
      status: "Open",
      priority: "High",
      createdAt: new Date(now - 1000 * 60 * 42).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 42).toISOString()
    },
    {
      id: "VMC-1003",
      serviceType: "potholes",
      title: "Potholes on Gotri main road",
      description: "Two large potholes are causing sudden braking during peak hours.",
      location: "Gotri Main Road",
      ward: "Ward 11",
      citizenName: "R. Desai",
      phone: "9988776655",
      latitude: 22.3128,
      longitude: 73.1348,
      status: "Resolved",
      priority: "Medium",
      createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString()
    }
  ];
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ complaints: seedComplaints(), users: seedUsers() }, null, 2));
  }
}

function readDb() {
  ensureStore();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  let changed = false;
  if (!Array.isArray(db.complaints)) {
    db.complaints = seedComplaints();
    changed = true;
  }
  if (!Array.isArray(db.users)) {
    db.users = seedUsers();
    changed = true;
  }
  if (changed) {
    writeDb(db);
  }
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function usePostgres() {
  return Boolean(DATABASE_URL) && !useMongo();
}

function useMongo() {
  return Boolean(MONGODB_URI);
}

function getPgPool() {
  if (!pgPool) {
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

function normalizeComplaint(row) {
  return {
    id: row.id,
    serviceType: row.service_type,
    title: row.title,
    description: row.description,
    location: row.location,
    ward: row.ward,
    citizenName: row.citizen_name,
    phone: row.phone,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    status: row.status,
    priority: row.priority,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function normalizeMongoComplaint(doc) {
  const { _id, ...complaint } = doc;
  return {
    ...complaint,
    createdAt: new Date(complaint.createdAt).toISOString(),
    updatedAt: new Date(complaint.updatedAt).toISOString()
  };
}

async function getMongoCollection() {
  if (!mongoClient) {
    const { MongoClient } = require("mongodb");
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
  }

  return mongoClient.db(MONGODB_DB).collection("complaints");
}

async function getMongoUsersCollection() {
  if (!mongoClient) {
    const { MongoClient } = require("mongodb");
    mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
  }

  return mongoClient.db(MONGODB_DB).collection("users");
}

async function ensureMongoDatabase() {
  if (!useMongo() || mongoReady) return;

  const collection = await getMongoCollection();
  const usersCollection = await getMongoUsersCollection();
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ createdAt: -1 });
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  const count = await collection.countDocuments();
  if (count === 0) {
    await collection.insertMany(seedComplaints().map((complaint) => ({ _id: complaint.id, ...complaint })));
  }
  const userCount = await usersCollection.countDocuments();
  if (userCount === 0) {
    await usersCollection.insertMany(seedUsers().map((user) => ({ _id: user.email, ...user })));
  }

  mongoReady = true;
}

async function ensureDatabase() {
  if (!usePostgres() || databaseReady) return;

  const pool = getPgPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      service_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      ward TEXT NOT NULL,
      citizen_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM complaints");
  if (countResult.rows[0].count === 0) {
    for (const complaint of seedComplaints()) {
      await insertPostgresComplaint(complaint);
    }
  }
  const userCountResult = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  if (userCountResult.rows[0].count === 0) {
    for (const user of seedUsers()) {
      await insertPostgresUser(user);
    }
  }

  databaseReady = true;
}

async function insertPostgresUser(user) {
  await getPgPool().query(
    `
      INSERT INTO users (email, password_hash, role, name, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `,
    [user.email, user.passwordHash, user.role, user.name, user.createdAt]
  );
}

async function insertPostgresComplaint(complaint) {
  const pool = getPgPool();
  await pool.query(
    `
      INSERT INTO complaints (
        id, service_type, title, description, location, ward, citizen_name, phone,
        latitude, longitude, status, priority, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      complaint.id,
      complaint.serviceType,
      complaint.title,
      complaint.description,
      complaint.location,
      complaint.ward,
      complaint.citizenName,
      complaint.phone,
      complaint.latitude,
      complaint.longitude,
      complaint.status,
      complaint.priority,
      complaint.createdAt,
      complaint.updatedAt
    ]
  );
}

async function getComplaints() {
  if (useMongo()) {
    await ensureMongoDatabase();
    const collection = await getMongoCollection();
    const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(normalizeMongoComplaint);
  }

  if (!usePostgres()) {
    return readDb().complaints;
  }

  await ensureDatabase();
  const result = await getPgPool().query("SELECT * FROM complaints ORDER BY created_at DESC");
  return result.rows.map(normalizeComplaint);
}

async function saveComplaint(complaint) {
  if (useMongo()) {
    await ensureMongoDatabase();
    const collection = await getMongoCollection();
    await collection.insertOne({ _id: complaint.id, ...complaint });
    return complaint;
  }

  if (!usePostgres()) {
    const db = readDb();
    db.complaints.unshift(complaint); // Store new ones at beginning
    writeDb(db);
    return complaint;
  }

  await ensureDatabase();
  await insertPostgresComplaint(complaint);
  return complaint;
}

async function updateComplaintStatus(id, status) {
  const updatedAt = new Date().toISOString();

  if (useMongo()) {
    await ensureMongoDatabase();
    const collection = await getMongoCollection();
    const result = await collection.findOneAndUpdate(
      { id },
      { $set: { status, updatedAt } },
      { returnDocument: "after" }
    );
    return result ? normalizeMongoComplaint(result) : null;
  }

  if (!usePostgres()) {
    const db = readDb();
    const complaint = db.complaints.find((item) => item.id === id);
    if (!complaint) return null;

    complaint.status = status;
    complaint.updatedAt = updatedAt;
    writeDb(db);
    return complaint;
  }

  await ensureDatabase();
  const result = await getPgPool().query(
    `
      UPDATE complaints
      SET status = $1, updated_at = $2
      WHERE id = $3
      RETURNING *
    `,
    [status, updatedAt, id]
  );

  return result.rows[0] ? normalizeComplaint(result.rows[0]) : null;
}

async function findUser(email) {
  const normalized = String(email || "").trim().toLowerCase();

  if (useMongo()) {
    await ensureMongoDatabase();
    const user = await (await getMongoUsersCollection()).findOne({ email: normalized });
    return user ? publicUser(user) : null;
  }

  if (!usePostgres()) {
    const user = readDb().users.find((item) => item.email === normalized);
    return user ? publicUser(user) : null;
  }

  await ensureDatabase();
  const result = await getPgPool().query("SELECT email, role, name FROM users WHERE email = $1", [normalized]);
  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

async function authenticateUser(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  let user;

  if (useMongo()) {
    await ensureMongoDatabase();
    user = await (await getMongoUsersCollection()).findOne({ email: normalized });
  } else if (!usePostgres()) {
    user = readDb().users.find((item) => item.email === normalized);
  } else {
    await ensureDatabase();
    const result = await getPgPool().query(
      "SELECT email, password_hash AS \"passwordHash\", role, name FROM users WHERE email = $1",
      [normalized]
    );
    user = result.rows[0];
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return publicUser(user);
}

async function createUserAccount({ email, password, name, role }) {
  const existing = await findUser(email);
  if (existing) {
    const error = new Error("Email is already registered");
    error.statusCode = 409;
    throw error;
  }

  const user = {
    email,
    passwordHash: hashPassword(password),
    role,
    name,
    createdAt: new Date().toISOString()
  };

  if (useMongo()) {
    await ensureMongoDatabase();
    await (await getMongoUsersCollection()).insertOne({ _id: user.email, ...user });
    return publicUser(user);
  }

  if (!usePostgres()) {
    const db = readDb();
    db.users.push(user);
    writeDb(db);
    return publicUser(user);
  }

  await ensureDatabase();
  await insertPostgresUser(user);
  return publicUser(user);
}

module.exports = {
  getComplaints,
  saveComplaint,
  updateComplaintStatus,
  findUser,
  authenticateUser,
  createUserAccount
};

function initDatabase() {
  if (!usePostgres() && !useMongo()) {
    ensureStore();
  }
}

module.exports.initDatabase = initDatabase;
