const { createHmac, randomBytes, scryptSync, timingSafeEqual } = require("crypto");
const { AUTH_SECRET, SESSION_COOKIE, IS_VERCEL } = require("./config.js");
const { sendJson } = require("./utils.js");

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

module.exports = {
  hashPassword,
  verifyPassword,
  validateAuthPayload,
  createSession,
  parseCookies,
  verifySession,
  sessionCookie,
  expiredSessionCookie,
  requireSession
};
