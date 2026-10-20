import { keyOk, sign } from "../lib/lib.mjs";
export default async (req) => {
  const u = new URL(req.url);
  if (!keyOk(u.searchParams.get("key"))) return new Response("Clé d'appli incorrecte.", { status: 403 });
  if (!process.env.STRAVA_CLIENT_ID) return new Response("STRAVA_CLIENT_ID manquant dans Netlify.", { status: 500 });
  const a = new URL("https://www.strava.com/oauth/authorize");
  a.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID);
  a.searchParams.set("redirect_uri", `${u.origin}/api/strava/callback`);
  a.searchParams.set("response_type", "code");
  a.searchParams.set("approval_prompt", "auto");
  a.searchParams.set("scope", "read,activity:read_all");
  a.searchParams.set("state", sign("strava-state"));
  return Response.redirect(a.toString(), 302);
};
export const config = { path: "/api/strava/auth" };
