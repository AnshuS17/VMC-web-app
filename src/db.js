const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { hashPassword, verifyPassword } = require("./auth.js");
const { MONGODB_URI, MONGODB_DB, SEED_USERS } = require("./config.js");

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

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const complaintSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true },
  serviceType: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  ward: { type: String, required: true },
  citizenName: { type: String, required: true },
  phone: { type: String, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  status: { type: String, required: true },
  priority: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const User = mongoose.model('User', userSchema, 'users');
const Complaint = mongoose.model('Complaint', complaintSchema, 'complaints');

function normalizeMongoComplaint(doc) {
  const { _id, ...complaint } = doc.toObject ? doc.toObject() : doc;
  return {
    ...complaint,
    createdAt: new Date(complaint.createdAt).toISOString(),
    updatedAt: new Date(complaint.updatedAt).toISOString()
  };
}

async function initDatabase() {
  if (databaseReady) return;

  try {
    let uri = MONGODB_URI;

    if (!uri) {
      console.log('⚠️ MONGODB_URI not found. Starting local in-memory database...');
      const mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
    }

    await mongoose.connect(uri, { dbName: MONGODB_DB });
    databaseReady = true;
    console.log(`✅ MongoDB connected successfully (${uri.includes('localhost') || uri.includes('127.0.0.1') ? 'Local/In-Memory' : 'Cloud'})`);

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.insertMany(seedUsers().map(u => ({ _id: u.email, ...u })));
    }
    const complaintCount = await Complaint.countDocuments();
    if (complaintCount === 0) {
      await Complaint.insertMany(seedComplaints().map(c => ({ _id: c.id, ...c })));
    }
  } catch (err) {
    databaseReady = false;
    console.error('❌ MongoDB connection error:', err);
  }
}

async function getComplaints() {
  await initDatabase();
  const docs = await Complaint.find({}).sort({ createdAt: -1 });
  return docs.map(normalizeMongoComplaint);
}

async function saveComplaint(complaint) {
  await initDatabase();
  const doc = new Complaint({
    _id: complaint.id,
    ...complaint
  });
  await doc.save();
  return complaint;
}

async function updateComplaintStatus(id, status) {
  await initDatabase();
  const updatedAt = new Date();
  const result = await Complaint.findOneAndUpdate(
    { id },
    { $set: { status, updatedAt } },
    { new: true }
  );
  return result ? normalizeMongoComplaint(result) : null;
}

async function findUser(email) {
  await initDatabase();
  const normalized = String(email || "").trim().toLowerCase();
  const user = await User.findOne({ email: normalized });
  return user ? publicUser(user) : null;
}

async function authenticateUser(email, password) {
  await initDatabase();
  const normalized = String(email || "").trim().toLowerCase();
  const user = await User.findOne({ email: normalized });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return publicUser(user);
}

async function createUserAccount({ email, password, name, role }) {
  await initDatabase();
  const existing = await findUser(email);
  if (existing) {
    const error = new Error("Email is already registered");
    error.statusCode = 409;
    throw error;
  }

  const user = new User({
    _id: email.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    role,
    name,
    createdAt: new Date()
  });

  await user.save();
  return publicUser(user);
}

module.exports = {
  initDatabase,
  getComplaints,
  saveComplaint,
  updateComplaintStatus,
  findUser,
  authenticateUser,
  createUserAccount
};
