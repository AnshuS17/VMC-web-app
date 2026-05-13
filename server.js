const http = require("http");
const fs = require("fs");
const path = require("path");
const { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("crypto");

try {
  require("dotenv").config();
} catch (error) {
  // dotenv is optional in production; Vercel provides environment variables directly.
}

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "127.0.0.1";
const IS_VERCEL = Boolean(process.env.VERCEL);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = IS_VERCEL ? path.join("/tmp", "vmc-data") : path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "complaints.json");
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "vmc_services";
const AUTH_SECRET = process.env.AUTH_SECRET || "vmc-local-demo-secret-change-before-production";
const SESSION_COOKIE = "vmc_session";
let pgPool;
let mongoClient;
let mongoReady = false;
let databaseReady = false;

const SEED_USERS = [
  {
    email: process.env.USER_EMAIL || "user@example.com",
    password: process.env.USER_PASSWORD || "user123",
    role: "user",
    name: "Citizen User"
  },
  {
    email: process.env.ADMIN_EMAIL || "admin@example.com",
    password: process.env.ADMIN_PASSWORD || "admin123",
    role: "admin",
    name: "VMC Admin"
  }
];

const SERVICE_TYPES = new Set([
  "garbage",
  "electricity",
  "waterlogging",
  "potholes",
  "drainage",
  "streetlight",
  "other"
]);

const PRIORITY_BY_TYPE = {
  electricity: "High",
  waterlogging: "High",
  potholes: "Medium",
  garbage: "Medium",
  drainage: "Medium",
  streetlight: "Low",
  other: "Low"
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ complaints: seedComplaints(), users: seedUsers() }, null, 2));
  }
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

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const candidate = hashPassword(password, salt).split(":")[1];
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = Buffer.from(candidate, "hex");
  return hashBuffer.length === candidateBuffer.length && timingSafeEqual(hashBuffer, candidateBuffer);
}

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

function validateAuthPayload(payload, mode) {
  const errors = {};
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "").trim();
  const name = String(payload.name || "").trim();
  const role = String(payload.role || "user").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }
  if (password.length < 6) {
    errors.password = "Use at least 6 characters";
  }
  if (mode === "signup" && payload.password !== payload.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }
  if (mode === "signup" && !name) {
    errors.name = "Enter your name";
  }
  if (!["user", "admin"].includes(role)) {
    errors.role = "Choose a valid account type";
  }
  if (mode === "signup" && role === "admin") {
    errors.role = "Admin sign up is disabled";
  }

  return { errors, email, password, name, role };
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

async function ensureMongoIndex(collection, key, options = {}) {
  const keySignature = JSON.stringify(key);
  const existingIndexes = await collection.indexes();
  const hasSameKey = existingIndexes.some((index) => JSON.stringify(index.key) === keySignature);
  if (!hasSameKey) {
    await collection.createIndex(key, options);
  }
}

async function ensureMongoDatabase() {
  if (!useMongo() || mongoReady) return;

  const collection = await getMongoCollection();
  const usersCollection = await getMongoUsersCollection();
  await ensureMongoIndex(collection, { id: 1 }, { unique: true });
  await ensureMongoIndex(collection, { createdAt: -1 });
  await ensureMongoIndex(usersCollection, { email: 1 }, { unique: true });
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
    db.complaints.push(complaint);
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

  if (useMongo()) {
    await (await getMongoUsersCollection()).updateOne(
      { email: normalized },
      { $set: { lastLoginAt: new Date().toISOString() } }
    );
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendJsonWithHeaders(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", AUTH_SECRET).update(value).digest("base64url");
}

function createSession(user) {
  const payload = JSON.stringify({
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 1000 * 60 * 60 * 8
  });
  const encoded = base64UrlEncode(payload);
  return `${encoded}.${sign(encoded)}`;
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separator = cookie.indexOf("=");
      if (separator === -1) return cookies;
      cookies[cookie.slice(0, separator)] = decodeURIComponent(cookie.slice(separator + 1));
      return cookies;
    }, {});
}

function verifySession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes(".")) return null;

  const [encoded, signature] = token.split(".");
  const expected = sign(encoded);
  const signatureBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!session.exp || session.exp < Date.now()) return null;
    return {
      email: session.email,
      role: session.role,
      name: session.name
    };
  } catch (error) {
    return null;
  }
}

function sessionCookie(token) {
  const secure = IS_VERCEL ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}

function expiredSessionCookie() {
  const secure = IS_VERCEL ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function requireSession(req, res, role) {
  const session = verifySession(req);
  if (!session) {
    sendJson(res, 401, { error: "Please log in to continue" });
    return null;
  }
  if (role && session.role !== role) {
    sendJson(res, 403, { error: "Admin access is required" });
    return null;
  }
  return session;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function validateComplaint(payload) {
  const errors = {};
  const required = ["serviceType", "title", "description", "location", "ward", "citizenName", "phone"];

  for (const field of required) {
    if (!String(payload[field] || "").trim()) {
      errors[field] = "Required";
    }
  }

  if (payload.serviceType && !SERVICE_TYPES.has(payload.serviceType)) {
    errors.serviceType = "Choose a valid service";
  }

  if (payload.phone && !/^[0-9]{10}$/.test(String(payload.phone).trim())) {
    errors.phone = "Enter a 10 digit mobile number";
  }

  if (payload.title && String(payload.title).length > 90) {
    errors.title = "Keep the title under 90 characters";
  }

  return errors;
}

function createComplaint(payload) {
  const createdAt = new Date().toISOString();
  return {
    id: `VMC-${randomUUID().slice(0, 8).toUpperCase()}`,
    serviceType: payload.serviceType,
    title: String(payload.title).trim(),
    description: String(payload.description).trim(),
    location: String(payload.location).trim(),
    ward: String(payload.ward).trim(),
    citizenName: String(payload.citizenName).trim(),
    phone: String(payload.phone).trim(),
    latitude: payload.latitude ? Number(payload.latitude) : null,
    longitude: payload.longitude ? Number(payload.longitude) : null,
    status: "Open",
    priority: PRIORITY_BY_TYPE[payload.serviceType] || "Low",
    createdAt,
    updatedAt: createdAt
  };
}

function getStats(complaints) {
  const byStatus = complaints.reduce((counts, complaint) => {
    counts[complaint.status] = (counts[complaint.status] || 0) + 1;
    return counts;
  }, {});

  const byType = complaints.reduce((counts, complaint) => {
    counts[complaint.serviceType] = (counts[complaint.serviceType] || 0) + 1;
    return counts;
  }, {});

  return {
    total: complaints.length,
    open: byStatus.Open || 0,
    inProgress: byStatus["In Progress"] || 0,
    resolved: byStatus.Resolved || 0,
    byType
  };
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "Vadodara Municipal Services" });
    return;
  }

  if (url.pathname === "/api/session" && req.method === "GET") {
    const session = verifySession(req);
    sendJson(res, 200, { authenticated: Boolean(session), user: session });
    return;
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    try {
      const payload = await readBody(req);
      const { errors, email, password } = validateAuthPayload(payload, "signin");
      if (Object.keys(errors).length) {
        sendJson(res, 400, { errors });
        return;
      }

      const user = await authenticateUser(email, password);

      if (!user) {
        sendJson(res, 401, { error: "Invalid login details" });
        return;
      }

      sendJsonWithHeaders(res, 200, { user }, { "Set-Cookie": sessionCookie(createSession(user)) });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/signup" && req.method === "POST") {
    try {
      const payload = await readBody(req);
      const { errors, email, password, name, role } = validateAuthPayload(payload, "signup");
      if (Object.keys(errors).length) {
        sendJson(res, 400, { errors });
        return;
      }

      const user = await createUserAccount({ email, password, name, role });
      sendJsonWithHeaders(res, 201, { user }, { "Set-Cookie": sessionCookie(createSession(user)) });
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    sendJsonWithHeaders(res, 200, { ok: true }, { "Set-Cookie": expiredSessionCookie() });
    return;
  }

  if (url.pathname === "/api/complaints" && req.method === "GET") {
    const session = requireSession(req, res);
    if (!session) return;

    const allComplaints = await getComplaints();
    const status = url.searchParams.get("status");
    const serviceType = url.searchParams.get("serviceType");
    const query = String(url.searchParams.get("q") || "").toLowerCase();

    let complaints = allComplaints.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (status && status !== "all") {
      complaints = complaints.filter((complaint) => complaint.status === status);
    }
    if (serviceType && serviceType !== "all") {
      complaints = complaints.filter((complaint) => complaint.serviceType === serviceType);
    }
    if (query) {
      complaints = complaints.filter((complaint) => {
        return [complaint.title, complaint.description, complaint.location, complaint.ward, complaint.id]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
    }

    sendJson(res, 200, { complaints, stats: getStats(allComplaints) });
    return;
  }

  if (url.pathname === "/api/complaints" && req.method === "POST") {
    const session = requireSession(req, res);
    if (!session) return;

    try {
      const payload = await readBody(req);
      const errors = validateComplaint(payload);
      if (Object.keys(errors).length) {
        sendJson(res, 400, { errors });
        return;
      }

      const complaint = createComplaint(payload);
      await saveComplaint(complaint);
      const complaints = await getComplaints();
      sendJson(res, 201, { complaint, stats: getStats(complaints) });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/status$/);
  if (statusMatch && req.method === "PATCH") {
    const session = requireSession(req, res, "admin");
    if (!session) return;

    try {
      const payload = await readBody(req);
      const allowedStatuses = new Set(["Open", "In Progress", "Resolved"]);
      if (!allowedStatuses.has(payload.status)) {
        sendJson(res, 400, { error: "Invalid status" });
        return;
      }

      const complaint = await updateComplaintStatus(statusMatch[1], payload.status);
      if (!complaint) {
        sendJson(res, 404, { error: "Complaint not found" });
        return;
      }

      const complaints = await getComplaints();
      sendJson(res, 200, { complaint, stats: getStats(complaints) });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

function serveStatic(req, res, url) {
  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
        res.end(fallback);
      });
      return;
    }

    const extension = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    res.end(content);
  });
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Server error" });
    }
    return;
  }

  serveStatic(req, res, url);
}

if (require.main === module) {
  if (!usePostgres()) {
    ensureStore();
  }
  const server = http.createServer(requestHandler);
  server.listen(PORT, HOST, () => {
    console.log(`Vadodara Municipal Services running at http://${HOST}:${PORT}`);
  });
}

module.exports = requestHandler;
