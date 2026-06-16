const serviceLabels = {
  garbage: "Garbage",
  electricity: "Electricity",
  waterlogging: "Water logging",
  potholes: "Potholes",
  drainage: "Drainage",
  streetlight: "Streetlight",
  other: "Other"
};

const form = document.querySelector("#complaintForm");
const formMessage = document.querySelector("#formMessage");
const caseList = document.querySelector("#caseList");
const template = document.querySelector("#caseTemplate");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const serviceFilter = document.querySelector("#serviceFilter");
const themeToggle = document.querySelector("#themeToggle");
const themeText = document.querySelector("#themeText");
const detectLocation = document.querySelector("#detectLocation");
const mapStatus = document.querySelector("#mapStatus");
const mapPreview = document.querySelector("#mapPreview");
const viewButtons = document.querySelectorAll("[data-view]");
const landingScreen = document.querySelector("#landingScreen");
const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const roleTabs = document.querySelectorAll("[data-login-role]");
const authModeTabs = document.querySelectorAll("[data-auth-mode]");
const authRoleTabs = document.querySelector("#authRoleTabs");
const authTitle = document.querySelector("#authTitle");
const authSubmitButton = document.querySelector("#authSubmitButton");
const signupOnlyNodes = document.querySelectorAll(".signup-only");
const userBadge = document.querySelector("#userBadge");
const logoutButton = document.querySelector("#logoutButton");
const adminOnlyNodes = document.querySelectorAll(".admin-only");
const citizenOnlyNodes = document.querySelectorAll(".citizen-only");
const casesKicker = document.querySelector("#casesKicker");
const casesTitle = document.querySelector("#casesTitle");
const casesNavLink = document.querySelector("#casesNavLink");
let currentUser = null;
let pendingHash = window.location.hash;
let statusChartInstance = null;
let typeChartInstance = null;

const vadodaraAreas = [
  { name: "Akota", ward: "Ward 10", latitude: 22.2939, longitude: 73.1645 },
  { name: "Alkapuri", ward: "Ward 7", latitude: 22.3122, longitude: 73.1687 },
  { name: "Gotri", ward: "Ward 11", latitude: 22.3128, longitude: 73.1348 },
  { name: "Fatehgunj", ward: "Ward 8", latitude: 22.3223, longitude: 73.1848 },
  { name: "Sayajigunj", ward: "Ward 6", latitude: 22.3079, longitude: 73.1818 },
  { name: "Karelibaug", ward: "Ward 4", latitude: 22.3236, longitude: 73.2037 },
  { name: "Manjalpur", ward: "Ward 12", latitude: 22.2709, longitude: 73.1888 },
  { name: "Waghodia Road", ward: "Ward 3", latitude: 22.3046, longitude: 73.2263 },
  { name: "Old Padra Road", ward: "Ward 9", latitude: 22.2962, longitude: 73.1461 },
  { name: "Nizampura", ward: "Ward 2", latitude: 22.3372, longitude: 73.1885 },
  { name: "Makarpura", ward: "Ward 1", latitude: 22.2425, longitude: 73.1945 }
];

const demoUsers = [
  { email: "user@example.com", password: "user123", role: "user", name: "Citizen User" },
  { email: "admin@example.com", password: "admin123", role: "admin", name: "VMC Admin" }
];
const staticStoreKey = "vmc-static-store";
const staticSessionKey = "vmc-static-session";
const isStaticHost = window.location.hostname.endsWith("github.io") || window.location.protocol === "file:";

function seedStaticComplaints() {
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

function readStaticStore() {
  const saved = JSON.parse(localStorage.getItem(staticStoreKey) || "null");
  if (saved && Array.isArray(saved.complaints) && Array.isArray(saved.users)) {
    return saved;
  }

  const store = { complaints: seedStaticComplaints(), users: demoUsers };
  writeStaticStore(store);
  return store;
}

function writeStaticStore(store) {
  localStorage.setItem(staticStoreKey, JSON.stringify(store));
}

function publicStaticUser(user) {
  return { email: user.email, role: user.role, name: user.name };
}

function staticError(message, data = {}) {
  const error = new Error(message);
  error.data = data;
  throw error;
}

function validateStaticAuth(payload) {
  const errors = {};
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "").trim();
  const name = String(payload.name || "").trim();
  const role = String(payload.role || "user").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address";
  if (password.length < 6) errors.password = "Use at least 6 characters";
  if (payload.mode === "signup" && payload.password !== payload.confirmPassword) errors.confirmPassword = "Passwords do not match";
  if (payload.mode === "signup" && !name) errors.name = "Enter your name";
  if (!["user", "admin"].includes(role)) errors.role = "Choose a valid account type";
  if (payload.mode === "signup" && role === "admin") errors.role = "Admin sign up is disabled";

  return { errors, email, password, name, role };
}

function validateStaticComplaint(payload) {
  const errors = {};
  const requiredFields = ["serviceType", "title", "description", "location", "ward", "citizenName", "phone"];
  requiredFields.forEach((field) => {
    if (!String(payload[field] || "").trim()) errors[field] = "This field is required";
  });
  if (payload.serviceType && !serviceLabels[payload.serviceType]) errors.serviceType = "Choose a valid service";
  if (payload.phone && !/^[0-9+\-\s]{8,15}$/.test(payload.phone)) errors.phone = "Enter a valid phone number";
  return errors;
}

function priorityForService(serviceType) {
  if (["electricity", "waterlogging"].includes(serviceType)) return "High";
  if (["garbage", "potholes", "drainage"].includes(serviceType)) return "Medium";
  return "Low";
}

function buildStats(complaints) {
  const stats = { total: complaints.length, open: 0, inProgress: 0, resolved: 0, byType: {} };
  Object.keys(serviceLabels).forEach((type) => {
    stats.byType[type] = 0;
  });
  complaints.forEach((complaint) => {
    if (complaint.status === "Open") stats.open += 1;
    if (complaint.status === "In Progress") stats.inProgress += 1;
    if (complaint.status === "Resolved") stats.resolved += 1;
    stats.byType[complaint.serviceType] = (stats.byType[complaint.serviceType] || 0) + 1;
  });
  return stats;
}

async function requestStaticJson(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const parsedUrl = new URL(url, window.location.origin);
  const store = readStaticStore();
  const sessionEmail = localStorage.getItem(staticSessionKey);
  const user = store.users.find((item) => item.email === sessionEmail);

  if (parsedUrl.pathname === "/api/session" && method === "GET") {
    if (!user) staticError("Not signed in");
    return { user: publicStaticUser(user) };
  }

  if (parsedUrl.pathname === "/api/login" && method === "POST") {
    const payload = JSON.parse(options.body || "{}");
    const match = store.users.find((item) => item.email === String(payload.email || "").toLowerCase() && item.password === payload.password);
    if (!match) staticError("Invalid email or password.");
    localStorage.setItem(staticSessionKey, match.email);
    return { user: publicStaticUser(match) };
  }

  if (parsedUrl.pathname === "/api/signup" && method === "POST") {
    const payload = JSON.parse(options.body || "{}");
    const { errors, email, password, name, role } = validateStaticAuth(payload);
    if (Object.keys(errors).length) staticError("Validation failed", { errors });
    if (store.users.some((item) => item.email === email)) staticError("An account already exists for this email.");
    const newUser = { email, password, role, name };
    store.users.push(newUser);
    writeStaticStore(store);
    localStorage.setItem(staticSessionKey, email);
    return { user: publicStaticUser(newUser) };
  }

  if (parsedUrl.pathname === "/api/logout" && method === "POST") {
    localStorage.removeItem(staticSessionKey);
    return { ok: true };
  }

  if (parsedUrl.pathname === "/api/complaints" && method === "GET") {
    if (!user) staticError("Please sign in to continue.");
    const status = parsedUrl.searchParams.get("status") || "all";
    const serviceType = parsedUrl.searchParams.get("serviceType") || "all";
    const query = (parsedUrl.searchParams.get("q") || "").toLowerCase();
    const complaints = store.complaints.filter((complaint) => {
      const matchesStatus = status === "all" || complaint.status === status;
      const matchesType = serviceType === "all" || complaint.serviceType === serviceType;
      const searchable = [complaint.title, complaint.description, complaint.location, complaint.ward, complaint.citizenName, complaint.id].join(" ").toLowerCase();
      return matchesStatus && matchesType && (!query || searchable.includes(query));
    });
    return { complaints, stats: buildStats(store.complaints) };
  }

  if (parsedUrl.pathname === "/api/complaints" && method === "POST") {
    if (!user) staticError("Please sign in to continue.");
    const payload = JSON.parse(options.body || "{}");
    const errors = validateStaticComplaint(payload);
    if (Object.keys(errors).length) staticError("Validation failed", { errors });
    const now = new Date().toISOString();
    const complaint = {
      id: `VMC-${1001 + store.complaints.length}`,
      serviceType: payload.serviceType,
      title: payload.title.trim(),
      description: payload.description.trim(),
      location: payload.location.trim(),
      ward: payload.ward.trim(),
      citizenName: payload.citizenName.trim(),
      phone: payload.phone.trim(),
      latitude: payload.latitude ? Number(payload.latitude) : null,
      longitude: payload.longitude ? Number(payload.longitude) : null,
      status: "Open",
      priority: priorityForService(payload.serviceType),
      createdAt: now,
      updatedAt: now
    };
    store.complaints.unshift(complaint);
    writeStaticStore(store);
    return { complaint };
  }

  const statusMatch = parsedUrl.pathname.match(/^\/api\/complaints\/([^/]+)\/status$/);
  if (statusMatch && method === "PATCH") {
    if (!user || user.role !== "admin") staticError("Only admins can update complaint status.");
    const payload = JSON.parse(options.body || "{}");
    const complaint = store.complaints.find((item) => item.id === statusMatch[1]);
    if (!complaint) staticError("Complaint not found.");
    if (!["Open", "In Progress", "Resolved"].includes(payload.status)) staticError("Choose a valid status.");
    complaint.status = payload.status;
    complaint.updatedAt = new Date().toISOString();
    writeStaticStore(store);
    return { complaint };
  }

  staticError("This action is not available on the static demo.");
}

async function requestJson(url, options = {}) {
  if (isStaticHost) {
    return requestStaticJson(url, options);
  }

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.data = data;
    throw error;
  }
  return data;
}

function setAuthenticated(user) {
  currentUser = user;
  landingScreen.hidden = Boolean(user);
  loginScreen.hidden = Boolean(user);
  appShell.hidden = !user;

  if (!user) {
    userBadge.textContent = "";
    adminOnlyNodes.forEach((node) => {
      node.hidden = true;
    });
    casesKicker.textContent = "Status tracking";
    casesTitle.textContent = "Complaint status";
    casesNavLink.textContent = "Status";
    showPublicView(window.location.hash || "#");
    return;
  }

  const isAdmin = user.role === "admin";
  adminOnlyNodes.forEach((node) => {
    node.hidden = !isAdmin;
  });
  citizenOnlyNodes.forEach((node) => {
    node.hidden = isAdmin;
  });
  casesKicker.textContent = isAdmin ? "Case management" : "Status tracking";
  casesTitle.textContent = isAdmin ? "Manage complaints" : "Complaint status";
  casesNavLink.textContent = isAdmin ? "Manage Cases" : "Status";
  userBadge.textContent = `${user.name} (${user.role})`;
  loadComplaints()
    .catch((error) => {
      caseList.innerHTML = `<div class="empty-state">${error.message}</div>`;
    })
    .finally(() => scrollToPendingHash());
}

function showPublicView(hash = window.location.hash) {
  if (currentUser) return;

  const normalizedHash = hash === "#signup" ? "#signup" : hash === "#login" ? "#login" : "#";
  const isAuthView = normalizedHash === "#login" || normalizedHash === "#signup";
  landingScreen.hidden = isAuthView;
  loginScreen.hidden = !isAuthView;
  appShell.hidden = true;

  if (normalizedHash === "#signup") {
    setAuthMode("signup");
  } else if (normalizedHash === "#login") {
    setAuthMode("signin");
  }

  if (!isAuthView) {
    setAuthErrors();
    loginMessage.textContent = "";
  }
}

function scrollToPendingHash() {
  const hash = pendingHash || window.location.hash;
  if (!currentUser || !hash) return;

  const target = document.querySelector(hash);
  if (!target) return;

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingHash = "";
  });
}

function setLoginRole(role) {
  loginForm.elements.role.value = role;
  const isSignup = loginForm.elements.mode.value === "signup";
  loginForm.elements.email.placeholder = "Email address";
  loginForm.elements.password.placeholder = isSignup ? "At least 6 characters" : "Password";
  roleTabs.forEach((button) => {
    const isActive = button.dataset.loginRole === role;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  updateAuthFields();
}

function setAuthMode(mode) {
  loginForm.elements.mode.value = mode;
  if (mode === "signup") {
    loginForm.elements.role.value = "user";
  }
  authTitle.textContent = mode === "signup" ? "Create your citizen account" : "Login to your account";
  authSubmitButton.textContent = mode === "signup" ? "Create Account" : "Login";
  loginForm.elements.name.required = mode === "signup";
  loginForm.elements.confirmPassword.required = mode === "signup";
  loginForm.elements.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  authRoleTabs.hidden = true;
  authModeTabs.forEach((button) => {
    const isActive = button.dataset.authMode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  setAuthErrors();
  updateAuthFields();
  setLoginRole(loginForm.elements.role.value);
}

function updateAuthFields() {
  const isSignup = loginForm.elements.mode.value === "signup";
  signupOnlyNodes.forEach((node) => {
    node.hidden = !isSignup;
  });
}

function setAuthErrors(errors = {}) {
  document.querySelectorAll("[data-auth-error-for]").forEach((node) => {
    node.textContent = errors[node.dataset.authErrorFor] || "";
  });
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set("status", statusFilter.value);
  params.set("serviceType", serviceFilter.value);
  if (searchInput.value.trim()) {
    params.set("q", searchInput.value.trim());
  }
  return params.toString();
}

async function loadComplaints() {
  const data = await requestJson(`/api/complaints?${buildQuery()}`);
  renderStats(data.stats);
  renderCases(data.complaints);
}

function renderStats(stats) {
  document.querySelector("#statTotal").textContent = stats.total;
  document.querySelector("#statOpen").textContent = stats.open;
  document.querySelector("#statProgress").textContent = stats.inProgress;
  document.querySelector("#statResolved").textContent = stats.resolved;

  if (currentUser && currentUser.role === "admin" && window.Chart) {
    renderCharts(stats);
  }
}

function renderCharts(stats) {
  const isDark = document.documentElement.dataset.theme === "dark";
  const textColor = isDark ? "#edf4f2" : "#18212c";
  const gridColor = isDark ? "#2f4650" : "#d9e0e8";
  const colors = { open: "#f4b740", progress: "#2f64b1", resolved: "#167a53", bar: "#0f6f78" };

  const statusCtx = document.getElementById("statusChart");
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }
  statusChartInstance = new Chart(statusCtx, {
    type: "doughnut",
    data: {
      labels: ["Open", "In Progress", "Resolved"],
      datasets: [{
        data: [stats.open, stats.inProgress, stats.resolved],
        backgroundColor: [colors.open, colors.progress, colors.resolved],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, padding: 20 } },
        title: { display: true, text: 'Complaints by Status', color: textColor, font: { size: 16 } }
      }
    }
  });

  const typeCtx = document.getElementById("typeChart");
  if (typeChartInstance) {
    typeChartInstance.destroy();
  }
  const typeLabels = Object.values(serviceLabels);
  const typeData = Object.keys(serviceLabels).map((key) => stats.byType[key] || 0);

  typeChartInstance = new Chart(typeCtx, {
    type: "bar",
    data: {
      labels: typeLabels,
      datasets: [{
        label: "Complaints",
        data: typeData,
        backgroundColor: colors.bar,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Complaints by Service Type', color: textColor, font: { size: 16 } }
      }
    }
  });
}

function renderCases(complaints) {
  caseList.innerHTML = "";

  if (!complaints.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No complaints match the current filters.";
    caseList.append(empty);
    return;
  }

  for (const complaint of complaints) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".case-id").textContent = `${complaint.id} / ${serviceLabels[complaint.serviceType]}`;
    node.querySelector("h3").textContent = complaint.title;
    node.querySelector(".case-description").textContent = complaint.description;
    node.querySelector(".case-location").textContent = complaint.location;
    node.querySelector(".case-ward").textContent = complaint.ward;
    node.querySelector(".case-date").textContent = formatDate(complaint.createdAt);
    const mapLink = node.querySelector(".case-map-link");
    if (complaint.latitude && complaint.longitude) {
      mapLink.href = buildMapLink(complaint.latitude, complaint.longitude);
      mapLink.textContent = "Open map";
    } else {
      mapLink.removeAttribute("href");
      mapLink.textContent = "Not added";
    }

    const priority = node.querySelector(".priority-pill");
    priority.textContent = `${complaint.priority} Priority`;
    priority.classList.toggle("high", complaint.priority === "High");
    priority.classList.toggle("low", complaint.priority === "Low");

    const status = node.querySelector(".status-pill");
    status.textContent = complaint.status;
    status.classList.add(statusClass(complaint.status));

    const select = node.querySelector(".status-select");
    select.value = complaint.status;
    if (currentUser && currentUser.role === "admin") {
      select.addEventListener("change", () => updateStatus(complaint.id, select.value));
    } else {
      select.remove();
    }

    caseList.append(node);
  }
}

function statusClass(status) {
  if (status === "Open") return "open";
  if (status === "In Progress") return "progress";
  return "resolved";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("vmc-theme", theme);
  const isDark = theme === "dark";
  themeText.textContent = isDark ? "Light" : "Dark";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function applyCaseView(view) {
  caseList.classList.toggle("grid-view", view === "grid");
  localStorage.setItem("vmc-case-view", view);
  viewButtons.forEach((button) => {
    const isActive = button.dataset.view === view;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function buildMapEmbed(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const delta = 0.014;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].map((value) => value.toFixed(5)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
}

function buildMapLink(latitude, longitude) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

function distanceKm(a, b) {
  const radius = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function nearestArea(latitude, longitude) {
  const point = { latitude, longitude };
  return vadodaraAreas
    .map((area) => ({ ...area, distance: distanceKm(point, area) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function setDetectedLocation(latitude, longitude) {
  const area = nearestArea(latitude, longitude);
  form.elements.latitude.value = latitude.toFixed(6);
  form.elements.longitude.value = longitude.toFixed(6);
  form.elements.location.value = `${area.name}, Vadodara (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
  form.elements.ward.value = area.ward;
  mapPreview.src = buildMapEmbed(latitude, longitude);
  mapStatus.textContent = `Detected near ${area.name}; ${area.ward} selected.`;
}

function setErrors(errors = {}) {
  document.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = errors[node.dataset.errorFor] || "";
  });
}

async function updateStatus(id, status) {
  if (!currentUser || currentUser.role !== "admin") {
    return;
  }

  await requestJson(`/api/complaints/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadComplaints();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setErrors();
  formMessage.textContent = "";

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const data = await requestJson("/api/complaints", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    formMessage.textContent = `Complaint ${data.complaint.id} submitted successfully.`;
    await loadComplaints();
    document.querySelector("#cases").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error.data && error.data.errors) {
      setErrors(error.data.errors);
      formMessage.textContent = "Please fix the highlighted fields.";
      return;
    }
    formMessage.textContent = error.message;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  setAuthErrors();

  const payload = Object.fromEntries(new FormData(loginForm).entries());
  if (payload.mode === "signup" && payload.password !== payload.confirmPassword) {
    setAuthErrors({ confirmPassword: "Passwords do not match" });
    loginMessage.textContent = "Please fix the highlighted fields.";
    return;
  }
  if (payload.mode !== "signup") {
    delete payload.role;
  }
  const endpoint = payload.mode === "signup" ? "/api/signup" : "/api/login";
  try {
    const data = await requestJson(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    loginForm.reset();
    setAuthMode("signin");
    setLoginRole(data.user.role);
    if (window.location.hash === "#login" || window.location.hash === "#signup") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setAuthenticated(data.user);
  } catch (error) {
    if (error.data && error.data.errors) {
      setAuthErrors(error.data.errors);
      loginMessage.textContent = "Please fix the highlighted fields.";
      return;
    }
    loginMessage.textContent = error.message;
  }
});

authModeTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const hash = button.dataset.authMode === "signup" ? "#signup" : "#login";
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      showPublicView(hash);
    }
  });
});

roleTabs.forEach((button) => {
  button.addEventListener("click", () => setLoginRole(button.dataset.loginRole));
});

logoutButton.addEventListener("click", async () => {
  await requestJson("/api/logout", { method: "POST" });
  window.location.hash = "#login";
  setAuthenticated(null);
  loginMessage.textContent = "Logged out successfully.";
});

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(current);
  if (currentUser && currentUser.role === "admin") {
    loadComplaints(); // Reload complaints to redraw charts with new theme colors
  }
});

// Password toggle functionality
const passwordToggles = document.querySelectorAll(".password-toggle");
passwordToggles.forEach((toggle) => {
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const input = toggle.parentElement.querySelector("input");
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    toggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    toggle.setAttribute("title", isPassword ? "Hide password" : "Show password");
    toggle.classList.toggle("is-hidden", !isPassword);
  });
});

detectLocation.addEventListener("click", () => {
  if (!navigator.geolocation) {
    mapStatus.textContent = "Location detection is not supported in this browser.";
    return;
  }

  mapStatus.textContent = "Requesting location permission...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setDetectedLocation(position.coords.latitude, position.coords.longitude);
    },
    () => {
      mapStatus.textContent = "Location permission was not granted. You can still type the area manually.";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
});

document.querySelectorAll("[data-service-card]").forEach((card) => {
  card.addEventListener("click", () => {
    const service = card.dataset.serviceCard;
    form.elements.serviceType.value = service;
    document.querySelector("#report").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;

    pendingHash = hash;
    window.location.hash = hash;

    if (!currentUser && (hash === "#login" || hash === "#signup")) {
      event.preventDefault();
      showPublicView(hash);
      loginScreen.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!currentUser) {
      event.preventDefault();
      loginMessage.textContent = "Please sign in to view that section.";
      showPublicView("#login");
      loginScreen.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const target = document.querySelector(hash);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      pendingHash = "";
    }
  });
});

window.addEventListener("hashchange", () => {
  if (!currentUser) {
    showPublicView(window.location.hash);
  }
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => applyCaseView(button.dataset.view));
});

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadComplaints, 180);
});
statusFilter.addEventListener("change", loadComplaints);
serviceFilter.addEventListener("change", loadComplaints);

applyTheme(localStorage.getItem("vmc-theme") || "light");
applyCaseView(localStorage.getItem("vmc-case-view") || "list");
setAuthMode("signin");
setLoginRole("user");
requestJson("/api/session")
  .then((data) => setAuthenticated(data.user))
  .catch(() => setAuthenticated(null));
