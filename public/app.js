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

  const breakdown = document.querySelector("#typeBreakdown");
  breakdown.innerHTML = "";
  const entries = Object.entries(serviceLabels).map(([key, label]) => {
    return [key, label, stats.byType[key] || 0];
  });

  for (const [key, label, count] of entries) {
    const row = document.createElement("div");
    row.className = "type-row";
    const percent = stats.total ? Math.round((count / stats.total) * 100) : 0;
    row.innerHTML = `
      <span>${label}</span>
      <span class="bar-track"><span class="bar-fill" style="width: ${percent}%"></span></span>
      <strong>${count}</strong>
    `;
    breakdown.append(row);
  }
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
    select.addEventListener("change", () => updateStatus(complaint.id, select.value));

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

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(current);
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
loadComplaints().catch((error) => {
  caseList.innerHTML = `<div class="empty-state">${error.message}</div>`;
});
