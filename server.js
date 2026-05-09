const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "complaints.json");

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
    fs.writeFileSync(DB_FILE, JSON.stringify({ complaints: seedComplaints() }, null, 2));
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

function readDb() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
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

  if (url.pathname === "/api/complaints" && req.method === "GET") {
    const db = readDb();
    const status = url.searchParams.get("status");
    const serviceType = url.searchParams.get("serviceType");
    const query = String(url.searchParams.get("q") || "").toLowerCase();

    let complaints = db.complaints.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

    sendJson(res, 200, { complaints, stats: getStats(db.complaints) });
    return;
  }

  if (url.pathname === "/api/complaints" && req.method === "POST") {
    try {
      const payload = await readBody(req);
      const errors = validateComplaint(payload);
      if (Object.keys(errors).length) {
        sendJson(res, 400, { errors });
        return;
      }

      const db = readDb();
      const complaint = createComplaint(payload);
      db.complaints.push(complaint);
      writeDb(db);
      sendJson(res, 201, { complaint, stats: getStats(db.complaints) });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/complaints\/([^/]+)\/status$/);
  if (statusMatch && req.method === "PATCH") {
    try {
      const payload = await readBody(req);
      const allowedStatuses = new Set(["Open", "In Progress", "Resolved"]);
      if (!allowedStatuses.has(payload.status)) {
        sendJson(res, 400, { error: "Invalid status" });
        return;
      }

      const db = readDb();
      const complaint = db.complaints.find((item) => item.id === statusMatch[1]);
      if (!complaint) {
        sendJson(res, 404, { error: "Complaint not found" });
        return;
      }

      complaint.status = payload.status;
      complaint.updatedAt = new Date().toISOString();
      writeDb(db);
      sendJson(res, 200, { complaint, stats: getStats(db.complaints) });
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  serveStatic(req, res, url);
});

ensureStore();
server.listen(PORT, HOST, () => {
  console.log(`Vadodara Municipal Services running at http://${HOST}:${PORT}`);
});
