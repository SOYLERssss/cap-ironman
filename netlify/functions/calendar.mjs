import { store, keyOk } from "../lib/lib.mjs";
const HDR = { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=900" };
export default async (req) => {
  const s = store();
  if (req.method === "POST") {
    if (!keyOk(req.headers.get("x-app-key"))) return new Response("Clé incorrecte", { status: 403 });
    const txt = await req.text();
    if (!txt.startsWith("BEGIN:VCALENDAR") || txt.length > 3_000_000) return new Response("Calendrier invalide", { status: 400 });
    await s.set("ics", txt);
    return new Response("ok");
  }
  const ics = await s.get("ics");
  if (ics) return new Response(ics, { headers: HDR });
  const r = await fetch(new URL("/plan-default.ics", req.url));
  return new Response(await r.text(), { headers: HDR });
};
export const config = { path: ["/plan.ics", "/api/calendar"] };
