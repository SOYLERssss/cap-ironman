import { store, sign } from "../lib/lib.mjs";
const page = (title, body) =>
  new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#0f141a;color:#e8edf2;font:16px/1.5 -apple-system,system-ui,sans-serif;padding:40px 20px;text-align:center}a{display:inline-block;margin-top:20px;background:#5eb1ef;color:#06121d;padding:12px 18px;border-radius:12px;font-weight:700;text-decoration:none}</style></head>
<body><h1>${title}</h1><p>${body}</p><a href="/?strava=ok">Retour à l'appli</a></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
export default async (req) => {
  const u = new URL(req.url);
  if (u.searchParams.get("state") !== sign("strava-state")) return page("Lien invalide", "Relance la connexion depuis Réglages.");
  if (u.searchParams.get("error")) return page("Connexion annulée", "Tu as refusé l'accès sur Strava.");
  const scope = u.searchParams.get("scope") || "";
  if (!scope.includes("activity:read")) return page("Accès incomplet", "Coche l'accès à tes activités sur l'écran Strava, puis recommence.");
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, code: u.searchParams.get("code"), grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!r.ok) return page("Erreur Strava", j.message || String(r.status));
  await store().setJSON("strava", { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at, athlete: { id: j.athlete?.id, name: j.athlete?.firstname } });
  return page("Strava connecté ✓", `Bonjour ${j.athlete?.firstname || ""} ! Tes activités vont être importées.`);
};
export const config = { path: "/api/strava/callback" };
