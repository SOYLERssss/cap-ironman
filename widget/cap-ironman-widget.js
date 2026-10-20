// Cap Ironman 2028 – widget (à coller UNE fois dans Scriptable)
// Ce petit script télécharge la dernière version du widget à chaque fois :
// plus besoin de recoller du code quand l'appli est mise à jour.
const URL = "https://vocal-puppy-e80bd4.netlify.app/widget/core.js";
const fm = module.filename.includes("Mobile Documents") ? FileManager.iCloud() : FileManager.local();
const path = fm.joinPath(module.filename.slice(0, module.filename.lastIndexOf("/")), "cap-ironman-core.js");
try {
  const r = new Request(URL); r.timeoutInterval = 10;
  const code = await r.loadString();
  if (code.includes("CAPIRONMAN_CORE")) fm.writeString(path, code);
} catch (e) {}
if (!fm.fileExists(path)) {
  const a = new Alert(); a.title = "Pas de connexion"; a.message = "Lance le script une première fois avec Internet."; a.addAction("OK"); await a.present();
} else {
  await importModule("cap-ironman-core").main();
}
Script.complete();
