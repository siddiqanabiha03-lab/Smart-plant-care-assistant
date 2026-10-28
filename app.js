/* Verdant — Smart Plant Care Assistant
 * Set API_BASE to your backend URL if it is not http://localhost:3000/api.
 */
const API_BASE = "http://localhost:3000/api";
const STORAGE_KEY = "verdant-demo-plants-v1";

const demoSeed = [
  { id: "demo-1", name: "Mona", species: "Monstera deliciosa", location: "Living room", light: "indirect", water_interval_days: 7, last_watered: daysAgo(5), notes: "Keep leaves dust-free." },
  { id: "demo-2", name: "Olive", species: "Ficus elastica", location: "Bedroom corner", light: "bright", water_interval_days: 9, last_watered: daysAgo(11), notes: "" },
  { id: "demo-3", name: "Pip", species: "Pothos", location: "Kitchen shelf", light: "low", water_interval_days: 8, last_watered: daysAgo(3), notes: "Let the top soil dry." },
  { id: "demo-4", name: "Ruby", species: "Anthurium", location: "Desk", light: "indirect", water_interval_days: 6, last_watered: daysAgo(7), notes: "" }
];
const tips = [
  { title: "Follow the light", body: "Most houseplants appreciate a consistent spot. Notice how the light changes throughout the day before moving your plant." },
  { title: "Check before you pour", body: "A calendar is a helpful reminder, but soil tells the real story. Check the top layer before watering to avoid keeping roots too wet." },
  { title: "Give leaves a little love", body: "Dust can block light from reaching leaves. Wipe broad leaves gently with a soft, damp cloth when they need it." },
  { title: "Rotate for balance", body: "Turn your pot a little every week or two so all sides get a chance to face the light and growth stays more even." },
  { title: "Drainage matters", body: "Use a pot with drainage holes when possible. Empty standing water from the saucer so roots are not left sitting in it." }
];
const plantEmojis = ["🪴", "🌿", "🌱", "🍃", "🌵", "🌷", "🌾", "🌳"];
let plants = [];
let demoMode = false;
let currentFilter = "all";
let tipIndex = 0;
let toastTimer;

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDate(d);
}
function localDate(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0,10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysSince(value) {
  const d = parseDate(value);
  if (!d) return Infinity;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.floor((today - d) / 86400000);
}
function isDue(plant) {
  return daysSince(plant.last_watered) >= Number(plant.water_interval_days || 7);
}
function dueInText(plant) {
  const elapsed = daysSince(plant.last_watered);
  if (!Number.isFinite(elapsed)) return "Add last watered";
  const interval = Number(plant.water_interval_days || 7);
  const remaining = interval - elapsed;
  if (remaining < 0) return `${Math.abs(remaining)}d overdue`;
  if (remaining === 0) return "Water today";
  return `In ${remaining}d`;
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
function readDemoPlants() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn("Could not read demo plants from local storage.", error);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSeed));
  return demoSeed.map(p => ({...p}));
}
function saveDemoPlants() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plants)); }
  catch (error) { console.warn("Could not save demo data.", error); }
}
async function loadPlants() {
  try {
    const data = await api("/plants");
    plants = Array.isArray(data.plants) ? data.plants : [];
    demoMode = false;
    setConnection(true, "API connected");
  } catch (error) {
    console.info("Using local demo mode:", error.message);
    plants = readDemoPlants();
    demoMode = true;
    setConnection(false, "Demo mode");
  }
  render();
}
function setConnection(connected, label) {
  const pill = document.getElementById("connectionStatus");
  pill.classList.toggle("connected", connected);
  pill.innerHTML = `<span class="status-dot"></span>${label}`;
  document.getElementById("footerMode").textContent = connected ? "Connected to your API" : "Demo data stored in this browser";
}
function setText(id, value) { document.getElementById(id).textContent = value; }
function render() {
  const dueCount = plants.filter(isDue).length;
  const total = plants.length;
  const onTrack = total ? Math.round(((total - dueCount) / total) * 100) : 100;
  setText("totalPlants", total);
  setText("navPlantCount", total);
  setText("needsWater", dueCount);
  setText("careScore", onTrack);
  setText("dailyMessage", dueCount ? `You have ${dueCount} plant${dueCount === 1 ? "" : "s"} ready for a check-in. A little attention goes a long way.` : "Your care rhythm is looking good. Take a moment to enjoy the new growth.");
  renderPlants();
}
function renderPlants() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const filtered = plants.filter(p => {
    const matches = [p.name, p.species, p.location].some(v => String(v || "").toLowerCase().includes(query));
    return matches && (currentFilter !== "due" || isDue(p));
  });
  const grid = document.getElementById("plantGrid");
  const empty = document.getElementById("emptyState");
  if (!filtered.length) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = filtered.map((p, index) => {
    const due = isDue(p);
    const emoji = plantEmojis[(index + Math.abs(hashCode(p.species || p.name))) % plantEmojis.length];
    const lightLabel = ({low:"Low light",indirect:"Indirect light",bright:"Bright light",direct:"Direct sun"})[p.light] || "Indirect light";
    return `<article class="plant-card">
      <div class="plant-visual visual-${index % 6}">
        <span class="plant-tag">${escapeHTML(lightLabel)}</span>
        <span class="plant-emoji" aria-hidden="true">${emoji}</span>
      </div>
      <div class="plant-info">
        <div class="plant-name-row"><h3 class="plant-name">${escapeHTML(p.name)}</h3></div>
        <p class="plant-species">${escapeHTML(p.species)}</p>
        <div class="plant-meta"><span class="plant-location">⌖ ${escapeHTML(p.location || "My home")}</span><span class="plant-water ${due ? "due" : ""}">◷ ${escapeHTML(dueInText(p))}</span></div>
        <div class="plant-actions"><button class="water-button" data-water="${escapeHTML(p.id)}">💧 I watered it</button><button class="delete-button" data-delete="${escapeHTML(p.id)}" aria-label="Delete ${escapeHTML(p.name)}" title="Delete plant">×</button></div>
      </div>
    </article>`;
  }).join("");
}
function hashCode(text) {
  let hash = 0;
  for (let i=0;i<text.length;i++) hash = ((hash << 5) - hash) + text.charCodeAt(i) | 0;
  return hash;
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function openModal() {
  const modal = document.getElementById("plantModal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.querySelector('#plantForm [name="name"]').focus();
}
function closeModal() {
  document.getElementById("plantModal").classList.add("hidden");
  document.body.style.overflow = "";
  document.getElementById("formError").classList.add("hidden");
}
async function addPlant(formData) {
  const payload = {
    name: String(formData.get("name") || "").trim(),
    species: String(formData.get("species") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    light: String(formData.get("light") || "indirect"),
    water_interval_days: Number(formData.get("water_interval_days") || 7),
    last_watered: String(formData.get("last_watered") || localDate(new Date())),
    notes: String(formData.get("notes") || "").trim()
  };
  if (!payload.name || !payload.species || !payload.location) throw new Error("Please complete the required fields.");
  if (!Number.isInteger(payload.water_interval_days) || payload.water_interval_days < 1 || payload.water_interval_days > 60) throw new Error("Watering interval must be between 1 and 60 days.");
  if (demoMode) {
    plants.unshift({ ...payload, id: `demo-${Date.now()}` });
    saveDemoPlants();
  } else {
    const result = await api("/plants", { method: "POST", body: JSON.stringify(payload) });
    plants.unshift(result.plant);
  }
  render();
}
async function waterPlant(id) {
  const plant = plants.find(p => String(p.id) === String(id));
  if (!plant) return;
  const today = localDate(new Date());
  if (demoMode) {
    plant.last_watered = today;
    saveDemoPlants();
  } else {
    const result = await api(`/plants/${encodeURIComponent(id)}/water`, { method: "PATCH", body: JSON.stringify({ watered_at: today }) });
    Object.assign(plant, result.plant);
  }
  render();
  showToast(`${plant.name} marked as watered. Keep growing!`);
}
async function deletePlant(id) {
  const plant = plants.find(p => String(p.id) === String(id));
  if (!plant) return;
  if (!window.confirm(`Remove ${plant.name} from your collection?`)) return;
  if (demoMode) {
    plants = plants.filter(p => String(p.id) !== String(id));
    saveDemoPlants();
  } else {
    await api(`/plants/${encodeURIComponent(id)}`, { method: "DELETE" });
    plants = plants.filter(p => String(p.id) !== String(id));
  }
  render();
  showToast(`${plant.name} removed from your collection.`);
}
function rotateTip() {
  tipIndex = (tipIndex + 1) % tips.length;
  setText("tipTitle", tips[tipIndex].title);
  setText("tipBody", tips[tipIndex].body);
}
function setToday() {
  setText("todayLabel", new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date()));
}
function bindEvents() {
  document.getElementById("openAddModal").addEventListener("click", openModal);
  document.getElementById("emptyAddButton").addEventListener("click", openModal);
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("cancelModal").addEventListener("click", closeModal);
  document.getElementById("plantModal").addEventListener("click", event => { if (event.target.id === "plantModal") closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
  document.getElementById("plantForm").addEventListener("submit", async event => {
    event.preventDefault();
    const errorBox = document.getElementById("formError");
    const button = document.getElementById("savePlantButton");
    errorBox.classList.add("hidden");
    button.disabled = true;
    button.textContent = "Saving...";
    try {
      await addPlant(new FormData(event.currentTarget));
      event.currentTarget.reset();
      event.currentTarget.elements.water_interval_days.value = "7";
      event.currentTarget.elements.last_watered.value = localDate(new Date());
      closeModal();
      showToast(demoMode ? "Plant saved in demo mode." : "Plant added to your collection.");
    } catch (error) {
      errorBox.textContent = error.message || "Could not save this plant. Please try again.";
      errorBox.classList.remove("hidden");
    } finally {
      button.disabled = false;
      button.innerHTML = 'Save plant <span>→</span>';
    }
  });
  document.getElementById("plantGrid").addEventListener("click", async event => {
    const waterButton = event.target.closest("[data-water]");
    const deleteButton = event.target.closest("[data-delete]");
    try {
      if (waterButton) await waterPlant(waterButton.dataset.water);
      if (deleteButton) await deletePlant(deleteButton.dataset.delete);
    } catch (error) { showToast(error.message || "Something went wrong. Please try again."); }
  });
  document.getElementById("searchInput").addEventListener("input", renderPlants);
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
    renderPlants();
  }));
  document.getElementById("showAllPlants").addEventListener("click", () => {
    currentFilter = "all";
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b.dataset.filter === "all"));
    document.getElementById("searchInput").value = "";
    renderPlants();
    document.getElementById("my-plants").scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("nextTip").addEventListener("click", rotateTip);
  document.getElementById("mobileMenu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => document.getElementById("sidebar").classList.remove("open")));
}
document.addEventListener("DOMContentLoaded", () => {
  setToday();
  document.querySelector('#plantForm [name="last_watered"]').value = localDate(new Date());
  bindEvents();
  loadPlants();
});
