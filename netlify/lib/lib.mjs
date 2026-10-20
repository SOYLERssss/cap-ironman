import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";

export const store = () => getStore("cap-ironman");
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export function keyOk(given) {
  const k = process.env.APP_KEY || "";
  if (!k || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(k);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const sign = (v) => createHmac("sha256", process.env.APP_KEY || "x").update(v).digest("hex").slice(0, 32);

export async function stravaToken() {
  const s = store();
  const t = await s.get("strava", { type: "json" });
  if (!t) throw new Error("Strava pas connecté");
  if (t.expires_at - 120 > Date.now() / 1000) return t;
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: t.refresh_token }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Rafraîchissement Strava refusé : " + (j.message || r.status));
  const n = { ...t, access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at };
  await s.setJSON("strava", n);
  return n;
}
