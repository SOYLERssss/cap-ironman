// Forme du jour : lue par le widget, alimentée par le widget et l'appli
import { keyOk, json, parisDay, saveAnswer, daysMap, scoreDay } from "../lib/lib.mjs";
export default async (req) => {
  const u = new URL(req.url);
  if (!keyOk(req.headers.get("x-app-key") || u.searchParams.get("key"))) return json({ error: "Clé d'appli incorrecte" }, 403);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("date") || "") ? u.searchParams.get("date") : parisDay();
  if (req.method === "POST") {
    let b = {}; try { b = await req.json(); } catch {}
    const d = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : date;
    await saveAnswer(d, b);
    const { days } = await daysMap(d);
    return json({ date: d, score: scoreDay(d, days) });
  }
  const { days } = await daysMap(date);
  return json({ date, score: scoreDay(date, days), answered: days[date]?.legs != null });
};
export const config = { path: "/api/well" };
