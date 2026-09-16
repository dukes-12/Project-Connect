/**
 * Rend chaque écran hors ligne et en capture une image.
 *
 * Les appels Supabase sont interceptés et servis depuis `donnees_factices.mjs`,
 * ce qui permet de voir les écrans avec du contenu plausible sans réseau. Ça ne
 * valide pas les requêtes — la base s'en charge — mais ça montre le rendu, ce
 * qu'aucun test de typage ni de bundling ne fait.
 *
 * Usage : node outils/captures.mjs <dossier-export> <dossier-captures>
 */

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

import { SESSION, reponsePour } from "./donnees_factices.mjs";

const REF_PROJET = "dosfpinsxhyqvmmailnq";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};

function servir(racine) {
  const serveur = createServer(async (requete, reponse) => {
    const chemin = decodeURIComponent(new URL(requete.url, "http://x").pathname);
    const candidat = join(racine, normalize(chemin));
    const fichier =
      candidat.startsWith(racine) && existsSync(candidat) && extname(candidat)
        ? candidat
        : join(racine, "index.html");
    try {
      const contenu = await readFile(fichier);
      reponse.writeHead(200, {
        "Content-Type": TYPES[extname(fichier)] ?? "application/octet-stream",
      });
      reponse.end(contenu);
    } catch (e) {
      reponse.writeHead(500);
      reponse.end(String(e));
    }
  });
  return new Promise((r) => serveur.listen(0, "127.0.0.1", () => r({ serveur, port: serveur.address().port })));
}

function executableChromium() {
  return [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    "/usr/bin/chromium",
  ]
    .filter(Boolean)
    .find((c) => existsSync(c));
}

const ECRANS = [
  ["accueil", "/"],
  ["cohorte", "/cohorte?carteId=22222222-2222-4222-8222-000000000001"],
  ["matchs", "/matchs?carteId=22222222-2222-4222-8222-000000000001"],
  ["conversations", "/conversations"],
  ["conversation", "/conversation/conv-groupe"],
  ["ville", "/ville?ville=Lisbonne&pays=Portugal"],
  ["checklist", "/checklist?carteId=22222222-2222-4222-8222-000000000001&pays=Portugal&ville=Lisbonne"],
  ["locaux", "/locaux?ville=Lisbonne&pays=Portugal"],
  ["comptes-bloques", "/comptes-bloques"],
  ["evenement-nouveau", "/evenement/nouveau?cityGuideId=ville-lisbonne&ville=Lisbonne&pays=Portugal"],
];

const [racine, dossierCaptures] = process.argv.slice(2);
if (!racine || !dossierCaptures) {
  console.error("Usage : node outils/captures.mjs <dossier-export> <dossier-captures>");
  process.exit(2);
}
await mkdir(dossierCaptures, { recursive: true });

const { serveur, port } = await servir(racine);
const chemin = executableChromium();
const navigateur = await chromium.launch(chemin ? { executablePath: chemin } : {});
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });

// Session déposée avant tout script de la page : au démarrage, supabase-js la
// lit et considère l'utilisateur connecté, sans toucher au réseau.
await contexte.addInitScript(
  ([cle, session]) => {
    try {
      window.localStorage.setItem(cle, JSON.stringify(session));
    } catch {
      /* stockage indisponible : l'app retombera sur l'écran de connexion */
    }
  },
  [`sb-${REF_PROJET}-auth-token`, SESSION],
);

const page = await contexte.newPage();

await page.route("**/*", async (route) => {
  const url = route.request().url();
  if (url.startsWith(`http://127.0.0.1:${port}`)) return route.continue();

  const corps = reponsePour(url);
  if (corps === null) {
    return route.fulfill({ status: 404, contentType: "application/json", body: "[]" });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(corps),
  });
});

let echecs = 0;
const erreursParEcran = new Map();
page.on("pageerror", (e) => {
  const liste = erreursParEcran.get(page.url()) ?? [];
  liste.push(`${e.name}: ${e.message}`);
  erreursParEcran.set(page.url(), liste);
});

for (const [nom, route] of ECRANS) {
  const avant = [...erreursParEcran.values()].flat().length;
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const corps = ((await page.textContent("body")) ?? "").replace(/\s+/g, " ").trim();
  const apres = [...erreursParEcran.values()].flat().length;
  const vide = corps.length < 40;
  const casse = apres > avant;

  await page.screenshot({ path: join(dossierCaptures, `${nom}.png`), fullPage: true });

  if (vide || casse) {
    echecs += 1;
    console.log(`ÉCHEC  ${nom} — ${casse ? "erreur d'exécution" : "écran vide"}`);
  } else {
    console.log(`ok     ${nom} — ${corps.slice(0, 70)}`);
  }
}

if (erreursParEcran.size > 0) {
  console.log("\nErreurs relevées :");
  for (const [url, liste] of erreursParEcran) console.log(`  ${url}\n    ${liste.join("\n    ")}`);
}

await navigateur.close();
serveur.close();
process.exit(echecs === 0 ? 0 : 1);
