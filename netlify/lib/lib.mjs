import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

export const store = () => getStore("cap-ironman");
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" } });

export function keyOk(given) {
  const k = process.env.APP_KEY || "";
  if (!k || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(k);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- intervals.icu ----------
export const API = "https://intervals.icu/api/v1";
export const ivHeaders = () => ({
  authorization: "Basic " + Buffer.from("API_KEY:" + (process.env.INTERVALS_API_KEY || "")).toString("base64"),
  "user-agent": "Mozilla/5.0 (CapIronman)", accept: "application/json",
});
export const parisDay = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
export const shiftDay = (k, n) => { const d = new Date(k + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Forme Garmin (sommeil, FC repos, VFC) normalisée
export async function wellness(oldest, newest) {
  if (!process.env.INTERVALS_API_KEY) return [];
  try {
    const r = await fetch(`${API}/athlete/0/wellness?oldest=${oldest}&newest=${newest}`, { headers: ivHeaders() });
    if (!r.ok) return [];
    return (await r.json()).map((w) => ({
      date: w.id, rhr: w.restingHR || null, hrv: w.hrv || null,
      sleepH: w.sleepSecs ? Math.round(w.sleepSecs / 360) / 10 : null, sleepScore: w.sleepScore || null,
    }));
  } catch { return []; }
}

// Réponses saisies (appli ou widget)
export async function answers() { return (await store().get("answers", { type: "json" })) || {}; }
export async function saveAnswer(date, a) {
  const all = await answers();
  const cur = all[date] || {};
  for (const k of ["sleep", "legs", "pain", "rhr"]) if (a[k] !== undefined && a[k] !== null && a[k] !== "") cur[k] = +a[k];
  cur.ts = Date.now();
  all[date] = cur;
  const keep = Object.keys(all).sort().slice(-90);
  const out = {}; keep.forEach((k) => (out[k] = all[k]));
  await store().setJSON("answers", out);
  return cur;
}

// ---------- Score de forme (même formule que l'appli) ----------
export const sleepFromGarmin = (g) => {
  if (!g) return null;
  if (g.sleepScore) return g.sleepScore >= 85 ? 5 : g.sleepScore >= 75 ? 4 : g.sleepScore >= 60 ? 3 : g.sleepScore >= 45 ? 2 : 1;
  if (g.sleepH) return g.sleepH >= 8 ? 5 : g.sleepH >= 7 ? 4 : g.sleepH >= 6 ? 3 : g.sleepH >= 5 ? 2 : 1;
  return null;
};
export function scoreDay(date, days) {
  // days : { 'AAAA-MM-JJ': {sleep, legs, pain, rhr, hrv, gSleep, gRhr} }
  const w = days[date];
  if (!w) return null;
  const has = ["sleep", "legs", "pain", "rhr", "gSleep", "gRhr", "hrv"].some((k) => w[k] != null);
  if (!has) return null;
  const sleep = w.sleep ?? w.gSleep ?? 3, legs = w.legs ?? 4, pain = w.pain ?? 0, rhr = w.rhr ?? w.gRhr, hrv = w.hrv;
  let s = (sleep - 1) / 4 * 30 + (legs - 1) / 4 * 40 + (3 - pain) / 3 * 30;
  const prev = (f) => { const v = []; for (let i = 1; i <= 14 && v.length < 7; i++) { const x = days[shiftDay(date, -i)]; const val = x && f(x); if (val) v.push(val); } return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  let pen = 0;
  const rb = prev((x) => x.rhr ?? x.gRhr);
  if (rhr && rb) { const dv = rhr - rb; pen += dv >= 8 ? 25 : dv >= 5 ? 15 : 0; }
  const hb = prev((x) => x.hrv);
  if (hrv && hb) { const r = hrv / hb; pen += r < 0.75 ? 25 : r < 0.85 ? 15 : 0; }
  s -= Math.min(30, pen);
  s = Math.max(0, Math.min(100, Math.round(s)));
  const c = pain >= 2 || s < 50 ? "red" : s < 70 ? "orange" : "green";
  const t = pain >= 2 ? "Douleur : pas de course" : c === "red" ? "Récup prioritaire" : c === "orange" ? "Séance allégée" : "Feu vert";
  return { s, c, t, legs: w.legs ?? null, pain: w.pain ?? null, sleep, rhr: rhr || null, hrv: hrv || null, sleepH: w.sleepH || null };
}
export async function daysMap(date) {
  const [ws, ans] = await Promise.all([wellness(shiftDay(date, -15), date), answers()]);
  const days = {};
  ws.forEach((g) => { days[g.date] = { gRhr: g.rhr, hrv: g.hrv, gSleep: sleepFromGarmin(g), sleepH: g.sleepH }; });
  Object.entries(ans).forEach(([d, a]) => { days[d] = { ...(days[d] || {}), ...a }; });
  return { days, ws, ans };
}
