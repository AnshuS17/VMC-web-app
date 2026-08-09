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
const homeView = document.querySelector("#homeView");
const portalViews = document.querySelector("#portalViews");
const portalLoginBtn = document.querySelector("#portalLoginBtn");

// Auth Elements
const signInForm = document.querySelector("#signInForm");
const signUpForm = document.querySelector("#signUpForm");
const forgotPasswordForm = document.querySelector("#forgotPasswordForm");
const signInCard = document.querySelector("#signInCard");
const signUpCard = document.querySelector("#signUpCard");
const forgotPasswordCard = document.querySelector("#forgotPasswordCard");
const btnForgotToggle = document.querySelector("#btnForgotToggle");
const btnBackToSignIn = document.querySelector("#btnBackToSignIn");
const btnMobileSignIn = document.querySelector("#btnMobileSignIn");
const btnMobileSignUp = document.querySelector("#btnMobileSignUp");
const signInMessage = document.querySelector("#signInMessage");
const signUpMessage = document.querySelector("#signUpMessage");
const forgotMessage = document.querySelector("#forgotMessage");
const btnSendReset = document.querySelector("#btnSendReset");
const userBadge = document.querySelector("#userBadge");
const logoutButton = document.querySelector("#logoutButton");
const adminOnlyNodes = document.querySelectorAll(".admin-only");
const citizenOnlyNodes = document.querySelectorAll(".citizen-only");
const casesKicker = document.querySelector("#casesKicker");
const casesTitle = document.querySelector("#casesTitle");
const casesNavLink = document.querySelector("#casesNavLink");
let currentUser = null;
let pendingHash = window.location.hash;

const portalRoutes = ['#portalLogin', '#report', '#dashboard', '#cases'];

function handleRoute() {
  const hash = window.location.hash || '#home';
  
  if (portalRoutes.includes(hash)) {
    homeView.hidden = true;
    portalViews.hidden = false;
    
    // Manage visibility inside portalViews
    document.querySelectorAll('#portalViews > section').forEach(sec => {
      sec.hidden = true;
    });
    
    if (hash === '#portalLogin') {
      loginScreen.hidden = false;
    } else if (currentUser) {
      const target = document.querySelector(hash);
      if (target) target.hidden = false;
    } else {
      // Not authenticated but trying to access a portal route
      loginScreen.hidden = false;
      if (signInMessage) signInMessage.textContent = "Please sign in to view that section.";
      window.location.hash = '#portalLogin';
    }
  } else {
    // Home routes
    homeView.hidden = false;
    portalViews.hidden = true;
    
    // Scroll to the specific section if it exists
    requestAnimationFrame(() => {
      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

window.addEventListener('hashchange', handleRoute);
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
  
  if (!user) {
    userBadge.hidden = true;
    logoutButton.hidden = true;
    portalLoginBtn.hidden = false;
    
    adminOnlyNodes.forEach((node) => {
      node.hidden = true;
    });
    citizenOnlyNodes.forEach((node) => {
      node.hidden = true;
    });
    
    if (casesKicker) casesKicker.textContent = "Status tracking";
    if (casesTitle) casesTitle.textContent = "Complaint status";
    if (casesNavLink) casesNavLink.textContent = "Status";
    
    handleRoute();
    return;
  }

  portalLoginBtn.hidden = true;
  userBadge.hidden = false;
  logoutButton.hidden = false;

  const isAdmin = user.role === "admin";
  adminOnlyNodes.forEach((node) => {
    node.hidden = !isAdmin;
  });
  citizenOnlyNodes.forEach((node) => {
    node.hidden = isAdmin;
  });
  if (casesKicker) casesKicker.textContent = isAdmin ? "Case management" : "Status tracking";
  if (casesTitle) casesTitle.textContent = isAdmin ? "Manage complaints" : "Complaint status";
  if (casesNavLink) casesNavLink.textContent = isAdmin ? "Manage Cases" : "Status";
  userBadge.textContent = `${user.name} (${user.role})`;
  
  loadComplaints().catch((error) => {
    if (caseList) caseList.innerHTML = `<div class="empty-state">${error.message}</div>`;
  });
  
  if (window.location.hash === '#portalLogin' || !window.location.hash) {
     window.location.hash = isAdmin ? '#dashboard' : '#cases';
  } else {
     handleRoute();
  }
}

function scrollToPendingHash() {
  // Handled by handleRoute now
}

function setAuthErrors(form, errors = {}) {
  form.querySelectorAll("[data-auth-error-for]").forEach((node) => {
    node.textContent = errors[node.dataset.authErrorFor] || "";
  });
}

function showForgotPassword() {
  signInCard.hidden = true;
  signUpCard.hidden = true;
  forgotPasswordCard.hidden = false;
}

function hideForgotPassword() {
  forgotPasswordCard.hidden = true;
  signInCard.hidden = false;
  signUpCard.hidden = false;
}

if (btnForgotToggle) btnForgotToggle.addEventListener("click", showForgotPassword);
if (btnBackToSignIn) btnBackToSignIn.addEventListener("click", hideForgotPassword);

if (btnMobileSignUp) {
  btnMobileSignUp.addEventListener("click", () => {
    signUpCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
if (btnMobileSignIn) {
  btnMobileSignIn.addEventListener("click", () => {
    signInCard.scrollIntoView({ behavior: "smooth", block: "start" });
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
  if (themeText) themeText.textContent = isDark ? "Light mode" : "Dark mode";
  if (themeToggle) themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
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

if (form) {
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
      window.location.hash = "#cases";
    } catch (error) {
      if (error.data && error.data.errors) {
        setErrors(error.data.errors);
        formMessage.textContent = "Please fix the highlighted fields.";
        return;
      }
      formMessage.textContent = error.message;
    }
  });
}

if (signInForm) {
  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    signInMessage.textContent = "";
    setAuthErrors(signInForm);

    const payload = Object.fromEntries(new FormData(signInForm).entries());
    const originalText = signInForm.querySelector(".submit-button").textContent;
    signInForm.querySelector(".submit-button").textContent = "Signing In...";
    
    try {
      const data = await requestJson("/api/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      signInForm.reset();
      setAuthenticated(data.user);
    } catch (error) {
      if (error.data && error.data.errors) {
        setAuthErrors(signInForm, error.data.errors);
        signInMessage.textContent = "Please fix the highlighted fields.";
      } else {
        signInMessage.textContent = error.message;
      }
    } finally {
      signInForm.querySelector(".submit-button").textContent = originalText;
    }
  });
}

if (signUpForm) {
  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    signUpMessage.textContent = "";
    setAuthErrors(signUpForm);

    const payload = Object.fromEntries(new FormData(signUpForm).entries());
    
    if (payload.password !== payload.confirmPassword) {
      setAuthErrors(signUpForm, { confirmPassword: "Passwords do not match" });
      signUpMessage.textContent = "Please fix the highlighted fields.";
      return;
    }

    const originalText = signUpForm.querySelector(".submit-button").textContent;
    signUpForm.querySelector(".submit-button").textContent = "Creating Account...";

    try {
      const data = await requestJson("/api/signup", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      signUpForm.reset();
      setAuthenticated(data.user);
    } catch (error) {
      if (error.data && error.data.errors) {
        setAuthErrors(signUpForm, error.data.errors);
        signUpMessage.textContent = "Please fix the highlighted fields.";
      } else {
        signUpMessage.textContent = error.message;
      }
    } finally {
      signUpForm.querySelector(".submit-button").textContent = originalText;
    }
  });
}

if (btnSendReset) {
  btnSendReset.addEventListener("click", () => {
    const email = forgotPasswordForm.elements.email.value;
    if (!email) {
      forgotMessage.textContent = "Please enter your email.";
      return;
    }
    forgotMessage.textContent = "Reset link sent if the email exists.";
    forgotMessage.style.color = "var(--text-primary)";
    forgotPasswordForm.reset();
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await requestJson("/api/logout", { method: "POST" });
    setAuthenticated(null);
    if (typeof loginMessage !== "undefined" && loginMessage) {
      loginMessage.textContent = "Logged out successfully.";
    }
  });
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(current);
    if (currentUser && currentUser.role === "admin") {
      loadComplaints(); // Reload complaints to redraw charts with new theme colors
    }
  });
}

if (detectLocation) {
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
}

const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    mainNav.style.display = mainNav.style.display === "flex" ? "none" : "flex";
    mainNav.style.flexDirection = "column";
    mainNav.style.position = "absolute";
    mainNav.style.top = "80px";
    mainNav.style.left = "0";
    mainNav.style.width = "100%";
    mainNav.style.background = "var(--bg-primary)";
    mainNav.style.padding = "20px";
    mainNav.style.borderBottom = "1px solid var(--border-color)";
    mainNav.style.boxShadow = "var(--shadow-subtle)";
  });
  
  // Close menu on link click
  mainNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        mainNav.style.display = "none";
      }
    });
  });
  
  // Handle resize back to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      mainNav.style.display = "flex";
      mainNav.style.flexDirection = "row";
      mainNav.style.position = "static";
      mainNav.style.padding = "0";
      mainNav.style.borderBottom = "none";
      mainNav.style.boxShadow = "none";
    } else {
      mainNav.style.display = "none";
    }
  });
}

document.querySelectorAll("[data-service-card]").forEach((card) => {
  card.addEventListener("click", () => {
    const service = card.dataset.serviceCard;
    if (form) form.elements.serviceType.value = service;
    window.location.hash = "#report";
  });
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    
    // Hash change will be handled by window.addEventListener('hashchange')
    // We just let the default behavior (URL change) happen.
  });
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => applyCaseView(button.dataset.view));
});

let searchTimer;
if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadComplaints, 180);
  });
}
if (statusFilter) statusFilter.addEventListener("change", loadComplaints);
if (serviceFilter) serviceFilter.addEventListener("change", loadComplaints);

applyTheme(localStorage.getItem("vmc-theme") || "light");
applyCaseView(localStorage.getItem("vmc-case-view") || "list");
requestJson("/api/session")
  .then((data) => setAuthenticated(data.user))
  .catch(() => setAuthenticated(null));
