/**
 * Test de fumée : sert le bundle web exporté et le charge dans Chromium.
 *
 * Ce que ça prouve — et c'est ce qui manquait jusqu'ici : l'application démarre
 * réellement, le routeur monte, le premier écran s'affiche, et rien ne lève à
 * l'exécution. Le typage et le bundling ne disent rien de tout ça.
 *
 * Ce que ça ne prouve pas : le rendu natif (iOS/Android), ni quoi que ce soit
 * qui dépende du réseau — l'environnement de développement bloque Supabase, et
 * le test le tient pour normal.
 *
 * Usage : node outils/fumee.mjs <dossier-export> [--screenshots <dossier>]
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

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

/** Serveur statique avec repli SPA : toute route inconnue rend index.html. */
function servir(racine) {
  const serveur = createServer(async (requete, reponse) => {
    const chemin = decodeURIComponent(new URL(requete.url, "http://x").pathname);
    // normalize() empêche de remonter hors de la racine avec des « .. ».
    const candidat = join(racine, normalize(chemin));
    const fichier =
      candidat.startsWith(racine) && existsSync(candidat) && extname(candidat)
        ? candidat
        : join(racine, "index.html");

    try {
      const contenu = await readFile(fichier);
      reponse.writeHead(200, { "Content-Type": TYPES[extname(fichier)] ?? "application/octet-stream" });
      reponse.end(contenu);
    } catch (e) {
      reponse.writeHead(500);
      reponse.end(String(e));
    }
  });

  return new Promise((resoudre) => {
    serveur.listen(0, "127.0.0.1", () => resoudre({ serveur, port: serveur.address().port }));
  });
}

/**
 * Les échecs réseau vers Supabase sont attendus ici : le proxy de
 * l'environnement les bloque. On les écarte pour ne garder que ce qui
 * révélerait un vrai défaut de l'app.
 */
function estBruitAttendu(texte) {
  return (
    /supabase\.co/i.test(texte) ||
    /Failed to fetch|NetworkError|ERR_|net::/i.test(texte) ||
    /AuthRetryableFetchError/i.test(texte)
  );
}

const racine = process.argv[2];
if (!racine) {
  console.error("Usage : node outils/fumee.mjs <dossier-export>");
  process.exit(2);
}
const dossierCaptures = process.argv.includes("--screenshots")
  ? process.argv[process.argv.indexOf("--screenshots") + 1]
  : null;

/**
 * Le Chromium préinstallé de l'environnement ne correspond pas toujours au
 * build qu'attend la version de Playwright installée. On le désigne
 * explicitement quand il est là, et on laisse Playwright se débrouiller sinon.
 */
function executableChromium() {
  const candidats = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  return candidats.find((c) => existsSync(c));
}

const { serveur, port } = await servir(racine);
const chemin = executableChromium();
const navigateur = await chromium.launch(chemin ? { executablePath: chemin } : {});
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();

const erreurs = [];
const bruit = [];
page.on("console", (message) => {
  if (message.type() !== "error") return;
  (estBruitAttendu(message.text()) ? bruit : erreurs).push(`console: ${message.text()}`);
});
page.on("pageerror", (e) => {
  const texte = `${e.name}: ${e.message}`;
  (estBruitAttendu(texte) ? bruit : erreurs).push(`exception: ${texte}`);
});

let echecs = 0;
function verifier(nom, condition, detail = "") {
  console.log(`${condition ? "ok  " : "ÉCHEC"}  ${nom}${detail ? ` — ${detail}` : ""}`);
  if (!condition) echecs += 1;
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  // L'app démarre par la restauration de session ; on laisse le temps au
  // routeur de trancher entre « chargement » et « écran de connexion ».
  await page.waitForTimeout(4000);

  const corps = (await page.textContent("body")) ?? "";
  verifier("la page rend du contenu", corps.trim().length > 0, `${corps.trim().length} caractères`);
  verifier(
    "l'écran de connexion s'affiche",
    corps.includes("Project-Connect") && /Se connecter/i.test(corps),
    corps.slice(0, 80).replace(/\s+/g, " "),
  );
  verifier(
    "le sous-titre de l'app est présent",
    /arrivent dans votre ville/i.test(corps),
  );
  verifier("aucune erreur d'exécution", erreurs.length === 0, erreurs.join(" | ") || "aucune");

  if (dossierCaptures) {
    await page.screenshot({ path: join(dossierCaptures, "connexion.png"), fullPage: true });
  }

  // Bascule vers l'inscription : vérifie qu'un état React réagit réellement.
  const bascule = page.getByText("Je n'ai pas encore de compte");
  if (await bascule.count()) {
    await bascule.first().click();
    await page.waitForTimeout(600);
    const apres = (await page.textContent("body")) ?? "";
    verifier("l'interaction bascule vers l'inscription", /Créer mon compte/i.test(apres));
    if (dossierCaptures) {
      await page.screenshot({ path: join(dossierCaptures, "inscription.png"), fullPage: true });
    }
  } else {
    verifier("le bouton de bascule est présent", false, "introuvable");
  }

  console.log(`\n${bruit.length} message(s) réseau ignoré(s) — Supabase est bloqué ici.`);
} finally {
  await navigateur.close();
  serveur.close();
}

process.exit(echecs === 0 ? 0 : 1);
