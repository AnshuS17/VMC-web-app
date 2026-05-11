const path = require("path");

try {
  require("dotenv").config();
} catch (error) {
  // dotenv is optional in production; Vercel provides environment variables directly.
}

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "127.0.0.1";
const IS_VERCEL = Boolean(process.env.VERCEL);
// We are in src/ so __dirname is src/, public is in ../public
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = IS_VERCEL ? path.join("/tmp", "vmc-data") : path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "complaints.json");

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "vmc_services";

const AUTH_SECRET = process.env.AUTH_SECRET || "vmc-local-demo-secret-change-before-production";
const SESSION_COOKIE = "vmc_session";

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

module.exports = {
  PORT,
  HOST,
  IS_VERCEL,
  PUBLIC_DIR,
  DATA_DIR,
  DB_FILE,
  DATABASE_URL,
  MONGODB_URI,
  MONGODB_DB,
  AUTH_SECRET,
  SESSION_COOKIE,
  SEED_USERS,
  SERVICE_TYPES,
  PRIORITY_BY_TYPE,
  MIME_TYPES
};
