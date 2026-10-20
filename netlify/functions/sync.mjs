// Import des activités Garmin via intervals.icu (clé API personnelle)
import { keyOk, json } from "../lib/lib.mjs";
const API = "https://intervals.icu/api/v1";
const RUN = new Set(["Run", "TrailRun", "VirtualRun"]);
export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);
  if (!keyOk(req.headers.get("x-app-key"))) return json({ error: "Clé d'appli incorrecte" }, 403);
  const key = process.env.INTERVALS_API_KEY;
  if (!key) return json({ error: "INTERVALS_API_KEY manquant dans Netlify" }, 500);
  let body = {};
  try { body = await req.json(); } catch {}
  const day = (s) => new Date(s * 1000).toISOString().slice(0, 10);
  const oldest = day(Math.max(0, +body.after || 0));
  const newest = day(Date.now() / 1000 + 86400);
  const H = { authorization: "Basic " + Buffer.from("API_KEY:" + key).toString("base64"), "user-agent": "Mozilla/5.0 (CapIronman)", accept: "application/json" };
  try {
    const r = await fetch(`${API}/athlete/0/activities?oldest=${oldest}&newest=${newest}`, { headers: H });
    if (r.status === 401 || r.status === 403) throw new Error("clé intervals.icu refusée (vérifie INTERVALS_API_KEY)");
    if (!r.ok) throw new Error("intervals.icu " + r.status);
    const acts = await r.json();
    let detail = 0;
    const out = [];
    for (const a of acts) {
      if (!a || !a.type || !(a.distance > 0)) continue;
      const o = {
        id: a.id, name: a.name || a.type, type: a.type, date: a.start_date_local,
        dist: a.distance, time: a.moving_time || a.elapsed_time, dplus: a.total_elevation_gain || 0,
        hr: a.average_heartrate || a.icu_average_hr || null, maxhr: a.max_heartrate || null, laps: null,
      };
      if (RUN.has(a.type) && o.time >= 900 && detail < 40) {
        detail++;
        const d = await fetch(`${API}/activity/${a.id}?intervals=true`, { headers: H });
        if (d.ok) {
          const j = await d.json();
          o.laps = (j.icu_intervals || []).map((l) => ({ dist: l.distance, time: l.moving_time || l.elapsed_time, hr: l.average_heartrate || null, work: l.type === "WORK" }));
        }
      }
      out.push(o);
    }
    return json({ athlete: "Garmin", activities: out });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
};
export const config = { path: "/api/sync" };
