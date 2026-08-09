const { randomUUID } = require("crypto");
const { SERVICE_TYPES, PRIORITY_BY_TYPE } = require("./config.js");
const { sendJson, sendJsonWithHeaders, readBody } = require("./utils.js");
const {
  validateAuthPayload,
  createSession,
  verifySession,
  sessionCookie,
  expiredSessionCookie,
  requireSession
} = require("./auth.js");
const {
  getComplaints,
  saveComplaint,
  updateComplaintStatus,
  authenticateUser,
  createUserAccount
} = require("./db.js");

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

  if (url.pathname === "/api/auth/firebase" && req.method === "POST") {
    try {
      const payload = await readBody(req);
      const { idToken } = payload;
      if (!idToken) {
        sendJson(res, 400, { error: "Missing Firebase token" });
        return;
      }
      
      const { verifyFirebaseToken } = require("./auth.js");
      const decoded = await verifyFirebaseToken(idToken);
      if (!decoded) {
        sendJson(res, 401, { error: "Invalid Firebase token" });
        return;
      }

      // Convert Firebase user to our user format
      // In a real app we would lookup the user in our DB by decoded.uid
      // For this demo, we'll create a session user on the fly.
      const userEmail = decoded.email || decoded.phone_number || decoded.uid;
      const role = userEmail.includes("admin") ? "admin" : "user";
      
      const user = {
        id: decoded.uid,
        email: userEmail,
        name: decoded.name || userEmail,
        role: role
      };

      sendJsonWithHeaders(res, 200, { user }, { "Set-Cookie": sessionCookie(createSession(user)) });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/signup" && req.method === "POST") {
    try {
      const payload = await readBody(req);
      const { errors, email, password, name, phone, role } = validateAuthPayload(payload, "signup");
      if (Object.keys(errors).length) {
        sendJson(res, 400, { errors });
        return;
      }

      const user = await createUserAccount({ email, password, name, phone, role });
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

module.exports = {
  handleApi
};
