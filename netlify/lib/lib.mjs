import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

export const store = () => getStore("cap-ironman");
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export function keyOk(given) {
  const k = process.env.APP_KEY || "";
  if (!k || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(k);
  return a.length === b.length && timingSafeEqual(a, b);
}
