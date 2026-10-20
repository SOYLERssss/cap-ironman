// Envoie les séances du plan dans le calendrier intervals.icu (→ Garmin Connect → montre)
import { keyOk, json, API, ivHeaders } from "../lib/lib.mjs";
export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);
  if (!keyOk(req.headers.get("x-app-key"))) return json({ error: "Clé d'appli incorrecte" }, 403);
  if (!process.env.INTERVALS_API_KEY) return json({ error: "INTERVALS_API_KEY manquant" }, 500);
  let b = {}; try { b = await req.json(); } catch {}
  const events = (b.events || []).filter((e) => e && /^capironman-/.test(e.external_id || "")).slice(0, 80);
  const remove = (b.remove || []).filter((id) => /^capironman-/.test(id)).slice(0, 80);
  const H = { ...ivHeaders(), "content-type": "application/json" };
  try {
    if (remove.length) {
      await fetch(`${API}/athlete/0/events/bulk-delete`, { method: "PUT", headers: H, body: JSON.stringify(remove.map((external_id) => ({ external_id }))) });
    }
    let n = 0;
    if (events.length) {
      const r = await fetch(`${API}/athlete/0/events/bulk?upsert=true`, { method: "POST", headers: H, body: JSON.stringify(events) });
      if (!r.ok) throw new Error("intervals.icu " + r.status + " " + (await r.text()).slice(0, 200));
      n = (await r.json()).length;
    }
    return json({ ok: true, sent: n, removed: remove.length });
  } catch (e) { return json({ error: e.message }, 502); }
};
export const config = { path: "/api/workouts" };
