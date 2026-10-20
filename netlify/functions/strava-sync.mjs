import { keyOk, json, stravaToken } from "../lib/lib.mjs";
const LAP_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);
  if (!keyOk(req.headers.get("x-app-key"))) return json({ error: "Clé d'appli incorrecte" }, 403);
  let body = {};
  try { body = await req.json(); } catch {}
  const after = Math.max(0, Math.floor(+body.after || 0));
  try {
    const t = await stravaToken();
    const H = { authorization: `Bearer ${t.access_token}` };
    const acts = [];
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: H });
      if (!r.ok) throw new Error("Strava " + r.status + (r.status === 429 ? " (limite de requêtes, réessaie dans 15 min)" : ""));
      const list = await r.json();
      acts.push(...list);
      if (list.length < 100) break;
    }
    let lapCalls = 0;
    const out = [];
    for (const a of acts) {
      const type = a.sport_type || a.type;
      const o = { id: a.id, name: a.name, type, date: a.start_date_local, dist: a.distance, time: a.moving_time, elapsed: a.elapsed_time, dplus: a.total_elevation_gain, hr: a.average_heartrate || null, maxhr: a.max_heartrate || null, laps: null };
      if (LAP_TYPES.has(type) && a.moving_time >= 900 && lapCalls < 40) {
        lapCalls++;
        const r = await fetch(`https://www.strava.com/api/v3/activities/${a.id}/laps`, { headers: H });
        if (r.ok) o.laps = (await r.json()).map((l) => ({ dist: l.distance, time: l.moving_time, hr: l.average_heartrate || null }));
      }
      out.push(o);
    }
    return json({ athlete: t.athlete?.name || null, activities: out });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
};
export const config = { path: "/api/strava/sync" };
