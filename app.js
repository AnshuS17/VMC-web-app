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
const themeIcon = document.querySelector(".theme-icon");
const detectLocation = document.querySelector("#detectLocation");
const mapStatus = document.querySelector("#mapStatus");
const mapPreview = document.querySelector("#mapPreview");
const viewButtons = document.querySelectorAll("[data-view]");
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

async function requestJson(url, options = {}) {
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
  loginForm.elements.email.placeholder = isSignup ? `${role}@example.com` : role === "admin" ? "admin@example.com" : "user@example.com";
  loginForm.elements.password.placeholder = isSignup ? "At least 6 characters" : role === "admin" ? "admin123" : "user123";
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
  authTitle.textContent = mode === "signup" ? "Create account" : "Sign in";
  authSubmitButton.textContent = mode === "signup" ? "Sign up" : "Sign in";
  loginForm.elements.name.required = mode === "signup";
  authRoleTabs.hidden = mode === "signup";
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
  themeIcon.textContent = isDark ? "L" : "D";
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
  const endpoint = payload.mode === "signup" ? "/api/signup" : "/api/login";
  try {
    const data = await requestJson(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    loginForm.reset();
    setAuthMode("signin");
    setLoginRole(data.user.role);
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
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

roleTabs.forEach((button) => {
  button.addEventListener("click", () => setLoginRole(button.dataset.loginRole));
});

logoutButton.addEventListener("click", async () => {
  await requestJson("/api/logout", { method: "POST" });
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

    if (!currentUser) {
      event.preventDefault();
      loginMessage.textContent = "Please sign in to view that section.";
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
