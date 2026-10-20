// Cap Ironman 2028 – widget « Aujourd'hui » + questionnaire de forme
// À coller dans Scriptable. Widget : When Interacting → Run Script.
const SITE = "https://vocal-puppy-e80bd4.netlify.app";
const KC = "capironman_appkey";
const fam = config.widgetFamily || "medium";
const pad = (n) => String(n).padStart(2, "0");
const now = new Date(), tom = new Date(now.getTime() + 86400000);
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const J = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const M = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const COL = { green: "#3fb950", orange: "#f0a33a", red: "#f0605d" };

// ---------- clé de l'appli (APP_KEY) ----------
async function getKey(ask) {
  if (Keychain.contains(KC)) return Keychain.get(KC);
  if (!ask) return null;
  const a = new Alert();
  a.title = "Clé de l'appli";
  a.message = "Entre ton APP_KEY (le mot de passe mis dans Netlify). Il est gardé dans le trousseau de l'iPhone.";
  a.addSecureTextField("APP_KEY");
  a.addAction("Enregistrer"); a.addCancelAction("Annuler");
  if ((await a.present()) === -1) return null;
  const k = a.textFieldValue(0).trim();
  if (k) Keychain.set(KC, k);
  return k || null;
}
async function api(method, key, body) {
  const r = new Request(`${SITE}/api/well?date=${dkey(now)}`);
  r.method = method; r.timeoutInterval = 15;
  r.headers = { "x-app-key": key, "content-type": "application/json" };
  if (body) r.body = JSON.stringify(body);
  const j = await r.loadJSON();
  if (r.response && r.response.statusCode === 403) { Keychain.remove(KC); throw new Error("Clé d'appli incorrecte"); }
  return j;
}

// ---------- questionnaire (appui sur le widget) ----------
async function ask(title, message, options) {
  const a = new Alert(); a.title = title; a.message = message || "";
  options.forEach((o) => a.addAction(o)); a.addCancelAction("Annuler");
  return await a.presentSheet();
}
async function questionnaire() {
  const key = await getKey(true);
  if (!key) return;
  let cur = null;
  try { cur = await api("GET", key); } catch (e) { const a = new Alert(); a.title = "Connexion impossible"; a.message = String(e.message || e); a.addAction("OK"); await a.present(); return; }
  const sc = cur && cur.score;
  const legs = await ask("Tes jambes ce matin ?", sc && sc.sleepH ? `⌚ Garmin : sommeil ${String(sc.sleepH).replace(".", ",")} h${sc.rhr ? " · FC repos " + sc.rhr : ""}` : "", ["5 · Super, je vole", "4 · Bien", "3 · Normal", "2 · Lourdes", "1 · Vides / courbatures fortes"]);
  if (legs < 0) return;
  const pain = await ask("Une douleur ?", "", ["Aucune", "Légère (ça ne change pas la foulée)", "Gêne (ça change la foulée)", "Je boite"]);
  if (pain < 0) return;
  const body = { date: dkey(now), legs: 5 - legs, pain };
  if (!(sc && sc.sleepH)) {
    const sl = await ask("Ton sommeil ?", "Pas de données de ta montre cette nuit.", ["5 · Excellent", "4 · Bon", "3 · Moyen", "2 · Mauvais", "1 · Très mauvais"]);
    if (sl >= 0) body.sleep = 5 - sl;
  }
  let res = null;
  try { res = await api("POST", key, body); } catch (e) {}
  const s = res && res.score;
  const a = new Alert();
  a.title = s ? `${s.c === "green" ? "🟢" : s.c === "orange" ? "🟠" : "🔴"} Forme ${s.s}/100 · ${s.t}` : "Enregistré";
  a.message = !s ? "" : s.c === "green" ? "Séance comme prévue. Bon entraînement !" :
    s.t.startsWith("Douleur") ? "La course est remplacée par du vélo / natation / elliptique sans douleur." :
    s.c === "red" ? "Séance intense remplacée par 30-40' très facile (ou repos)." :
    "Séance allégée : 1 répétition sur 4 en moins, 5 s/km plus lent.";
  a.addAction("Voir la séance"); a.addCancelAction("OK");
  if ((await a.present()) === 0) Safari.open(SITE);
}

// ---------- widget ----------
async function loadICS() {
  const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), "cap-ironman.ics");
  try { const r = new Request(`${SITE}/plan.ics`); r.timeoutInterval = 15; const t = await r.loadString(); fm.writeString(cache, t); return t; }
  catch (e) { return fm.fileExists(cache) ? fm.readString(cache) : null; }
}
const un = (s) => s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
function parse(txt, k) {
  if (!txt) return null;
  k = k.replace(/-/g, "");
  const lines = txt.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); let ev = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") ev = {};
    else if (l === "END:VEVENT") { if (ev && ev.start === k) return ev; ev = null; }
    else if (ev) {
      if (l.startsWith("DTSTART")) ev.start = l.split(":")[1];
      else if (l.startsWith("SUMMARY:")) ev.sum = un(l.slice(8));
      else if (l.startsWith("DESCRIPTION:")) ev.desc = un(l.slice(12));
    }
  }
  return null;
}
async function widget() {
  const [txt, key] = [await loadICS(), await getKey(false)];
  let well = null;
  if (key) { try { well = await api("GET", key); } catch (e) {} }
  const sc = well && well.score;
  const w = new ListWidget();
  w.backgroundColor = new Color("#0f141a"); w.setPadding(14, 14, 12, 14);
  const grey = new Color("#8fa0b3"), light = new Color("#c7d2dd");

  const top = w.addStack(); top.centerAlignContent();
  const h = top.addText(`${J[now.getDay()]} ${now.getDate()} ${M[now.getMonth()]}`);
  h.font = Font.semiboldSystemFont(11); h.textColor = grey;
  top.addSpacer();
  if (sc) {
    const b = top.addStack(); b.backgroundColor = new Color(COL[sc.c], 0.22); b.cornerRadius = 8; b.setPadding(2, 7, 2, 7);
    const bt = b.addText(`${sc.c === "green" ? "🟢" : sc.c === "orange" ? "🟠" : "🔴"} ${sc.s}`); bt.font = Font.boldSystemFont(11); bt.textColor = new Color(COL[sc.c]);
  }
  w.addSpacer(5);

  const blocksOf = (ev) => { if (!ev) return { list: [], phase: "", gym: false }; const b = (ev.desc || "").split("\n\n"), phase = b.pop(); const sport = b.filter((x) => !x.startsWith("💪")); return { list: sport.length ? sport : b, phase, gym: b.some((x) => x.startsWith("💪")) && sport.length > 0 }; };
  const today = blocksOf(parse(txt, dkey(now)));
  if (!today.list.length) { const t = w.addText("😴 Repos"); t.font = Font.boldSystemFont(15); t.textColor = Color.white(); }
  for (const b of today.list.slice(0, fam === "small" ? 2 : 2)) {
    const [title, ...rest] = b.split("\n");
    const t = w.addText(title); t.font = Font.boldSystemFont(fam === "small" ? 13 : 15); t.textColor = Color.white(); t.lineLimit = fam === "small" ? 2 : 1; t.minimumScaleFactor = 0.75;
    if (fam !== "small" && rest.length) { const d = w.addText(rest.join(" ")); d.font = Font.systemFont(12); d.textColor = light; d.lineLimit = fam === "large" ? 4 : 2; }
    w.addSpacer(3);
  }
  if (today.gym && fam !== "small") { const g = w.addText("💪 + salle"); g.font = Font.systemFont(11); g.textColor = new Color("#b48cff"); }

  if (fam === "large") {
    w.addSpacer(8);
    const hh = w.addText(`Demain · ${J[tom.getDay()]} ${tom.getDate()} ${M[tom.getMonth()]}`); hh.font = Font.semiboldSystemFont(11); hh.textColor = grey; w.addSpacer(4);
    const tm = blocksOf(parse(txt, dkey(tom)));
    if (!tm.list.length) { const t = w.addText("😴 Repos"); t.font = Font.boldSystemFont(13); t.textColor = Color.white(); }
    tm.list.slice(0, 3).forEach((b) => { const t = w.addText(b.split("\n")[0]); t.font = Font.boldSystemFont(13); t.textColor = Color.white(); t.lineLimit = 1; });
  }
  w.addSpacer();
  let foot;
  if (!key) foot = "👆 Touche pour configurer";
  else if (!well || !well.answered) foot = "👆 Touche pour donner ta forme";
  else if (sc && sc.c !== "green") foot = sc.t.startsWith("Douleur") ? "⚠ Course remplacée (douleur)" : sc.c === "red" ? "⚠ Récup : séance intense remplacée" : "⚠ Séance allégée";
  else foot = today.phase || "";
  const f = w.addText(foot); f.font = Font.systemFont(10); f.lineLimit = 1;
  f.textColor = sc && sc.c !== "green" && well.answered ? new Color(COL[sc.c]) : grey;
  if (!txt) { const e = w.addText("Pas de connexion"); e.font = Font.systemFont(10); e.textColor = grey; }
  w.refreshAfterDate = new Date(Date.now() + 60 * 60000);
  return w;
}

if (config.runsInWidget) Script.setWidget(await widget());
else { await questionnaire(); }
Script.complete();
