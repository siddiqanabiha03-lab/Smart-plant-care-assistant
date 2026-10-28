require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5500";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

app.use(cors({
  origin(origin, callback) {
    // Permit requests without Origin (curl/health checks) and the configured frontend origin.
    if (!origin || origin === FRONTEND_ORIGIN) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "32kb" }));

function requireDatabase(req, res, next) {
  if (!supabase) {
    return res.status(503).json({ error: "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env." });
  }
  next();
}
function validId(id) {
  // UUIDs in Supabase, with demo IDs intentionally not accepted by the real API.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
function validatePlant(body) {
  const errors = [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const species = typeof body.species === "string" ? body.species.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const light = body.light || "indirect";
  const interval = Number(body.water_interval_days ?? 7);
  if (!name || name.length > 80) errors.push("name is required and must be at most 80 characters.");
  if (!species || species.length > 100) errors.push("species is required and must be at most 100 characters.");
  if (!location || location.length > 100) errors.push("location is required and must be at most 100 characters.");
  if (!["low", "indirect", "bright", "direct"].includes(light)) errors.push("light must be low, indirect, bright, or direct.");
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) errors.push("water_interval_days must be an integer from 1 to 60.");
  const lastWatered = body.last_watered || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lastWatered)) || Number.isNaN(new Date(`${lastWatered}T00:00:00Z`).getTime())) {
    errors.push("last_watered must be a valid YYYY-MM-DD date.");
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 500) errors.push("notes must be at most 500 characters.");
  return {
    errors,
    value: {
      name, species, location, light, water_interval_days: interval,
      last_watered: String(lastWatered),
      notes
    }
  };
}
function sendDbError(res, error) {
  console.error("Supabase request failed:", error.message);
  return res.status(500).json({ error: "The database request failed. Check the Supabase schema and server logs." });
}

app.get("/api/health", async (req, res) => {
  if (!supabase) return res.json({ status: "ok", databaseConfigured: false, message: "API running; database credentials are not configured." });
  const { error } = await supabase.from("plants").select("id").limit(1);
  if (error) return res.status(503).json({ status: "degraded", databaseConfigured: true, databaseConnected: false, message: "Database query failed." });
  return res.json({ status: "ok", databaseConfigured: true, databaseConnected: true });
});

app.get("/api/plants", requireDatabase, async (req, res) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  const status = String(req.query.status || "all");
  let query = supabase.from("plants").select("*").order("created_at", { ascending: false });
  if (search) query = query.or(`name.ilike.%${search.replace(/[%_,()]/g, "")}%,species.ilike.%${search.replace(/[%_,()]/g, "")}%`);
  const { data, error } = await query;
  if (error) return sendDbError(res, error);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const plants = (data || []).map(plant => {
    const last = new Date(`${plant.last_watered}T00:00:00`);
    const elapsed = Number.isNaN(last.getTime()) ? Infinity : Math.floor((today - last) / 86400000);
    return { ...plant, watering_due: elapsed >= plant.water_interval_days };
  }).filter(plant => status !== "due" || plant.watering_due);
  return res.json({ plants });
});

app.post("/api/plants", requireDatabase, async (req, res) => {
  const { errors, value } = validatePlant(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });
  const { data, error } = await supabase.from("plants").insert(value).select("*").single();
  if (error) return sendDbError(res, error);
  return res.status(201).json({ plant: data });
});

app.patch("/api/plants/:id/water", requireDatabase, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "A valid plant ID is required." });
  const wateredAt = req.body && req.body.watered_at ? String(req.body.watered_at) : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wateredAt) || Number.isNaN(new Date(`${wateredAt}T00:00:00Z`).getTime())) {
    return res.status(400).json({ error: "watered_at must be a valid YYYY-MM-DD date." });
  }
  const { data, error } = await supabase.from("plants").update({ last_watered: wateredAt }).eq("id", req.params.id).select("*").maybeSingle();
  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: "Plant not found." });
  return res.json({ plant: data });
});

app.delete("/api/plants/:id", requireDatabase, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "A valid plant ID is required." });
  const { data, error } = await supabase.from("plants").delete().eq("id", req.params.id).select("id").maybeSingle();
  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: "Plant not found." });
  return res.json({ deleted: true, id: data.id });
});

app.get("/api/tips", (req, res) => {
  res.json({ tips: [
    { title: "Check soil before watering", category: "watering", body: "Watering schedules are reminders. Check soil moisture and the plant's needs before watering." },
    { title: "Match light to the plant", category: "light", body: "Observe the light in a spot during the day and check the care needs for your plant species." },
    { title: "Make drainage a priority", category: "watering", body: "Avoid leaving roots in standing water; use suitable drainage for your plant and pot." },
    { title: "Inspect leaves regularly", category: "health", body: "Look for unusual spots, pests, yellowing, or dust when you check your plants." }
  ] });
});

app.use((req, res) => res.status(404).json({ error: "Route not found." }));
app.use((err, req, res, next) => {
  if (err && err.message === "Origin is not allowed by CORS.") return res.status(403).json({ error: err.message });
  console.error("Unhandled server error:", err);
  return res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`Verdant API listening on http://localhost:${PORT}`);
  if (!supabase) console.warn("Supabase credentials are missing; database routes will return 503 until configured.");
});
