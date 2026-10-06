// Génère les aperçus de `docs/apercus/` à partir de `src/Index.html`.
//
// Le registre est servi sur un serveur HTTP local et `google.script.run` est
// remplacé par un stub qui répond avec les données de `apercus-donnees.mjs`.
// Aucun appel Apps Script, aucune lecture ni écriture du classeur réel.
//
//   node scripts/capture-apercus.mjs                  toutes les pages décrites
//   node scripts/capture-apercus.mjs presences prison  une sélection
//
// Prérequis : Microsoft Edge installé (canal `msedge`), et `npm run build` à
// jour — le script capture le `src/Index.html` présent, il ne le régénère pas.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import * as donnees from "./apercus-donnees.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(rootDir, "src", "Index.html");
const outDir = path.join(rootDir, "docs", "apercus");

// Réponses du stub, par nom de fonction serveur. Un nom absent d'ici fait
// échouer l'appel côté page avec un message explicite, plutôt que de laisser
// un écran de chargement silencieux.
const reponses = {
  login: () => "jeton-de-demonstration",
  getSessionInfo: () => donnees.sessionInfo,
  getPresences: () => donnees.presences,
  getPresenceOfficerDashboard: () => donnees.presenceDashboard,
  getPaye: () => donnees.paye,
  getInventaire: () => donnees.inventaire,
  getPrison: () => donnees.prison,
  getPrisonFormData: () => donnees.prisonForm,
  getCatalogueObjets: () => donnees.catalogueObjets,
  getAmendes: () => donnees.amendes,
  getAmendeFormData: () => donnees.amendeForm,
  getCodex: () => donnees.codex,
  getPeinesAmendes: () => donnees.peines,
  getOrganigramme: () => donnees.organigramme,
  getEffectifs: () => donnees.effectifs
};

// Chaque aperçu : le libellé du bouton de navigation, les largeurs voulues,
// une préparation facultative (ouvrir un formulaire, dérouler un panneau…) et
// des réponses serveur propres à la page, superposées aux réponses communes —
// c'est ainsi que l'on capture une même page sous un autre rôle.
const apercus = {
  organigramme: {
    nav: "Organigramme",
    attendre: ".org-hierarchy",
    largeurs: [390, 1440]
  },
  "organigramme-grade": {
    nav: "Organigramme",
    attendre: ".org-hierarchy",
    largeurs: [1440],
    // Ouvre une description de grade repliée, pour la montrer sur la capture.
    async preparer(page) {
      // `:visible` écarte les grades du Hird, dont le personnel est replié.
      await page.locator(".org-rank-title .grade-info-button:visible").first().click();
      await page.waitForSelector(".grade-info-panel");
    }
  },
  effectifs: {
    nav: "Effectifs",
    attendre: ".effectifs-tabs",
    largeurs: [390, 1440]
  },
  presences: {
    nav: "Présences",
    attendre: ".presence-table",
    largeurs: [390, 1440]
  },
  "presences-synthese": {
    nav: "Présences",
    attendre: ".presence-table",
    largeurs: [1440],
    // La synthèse OFFICIER est repliée par défaut : on la déroule, sans quoi
    // aucun aperçu ne montrerait plus les tuiles ni les gardes à surveiller.
    async preparer(page) {
      await page.locator(".presence-synthese-toggle").click();
      await page.waitForSelector(".presence-inactive-panel");
    }
  },
  "presences-impayes": {
    nav: "Présences",
    attendre: ".presence-table",
    largeurs: [1440],
    // Filtre des impayés d'une semaine passée, accordéon replié au départ.
    async preparer(page) {
      const semainePassee = page.locator(".week-section.week-old").first();
      await semainePassee.locator(".week-unpaid-filter").click();
      await page.waitForSelector(".week-unpaid-notice");
    }
  },
  paye: {
    nav: "Paye",
    attendre: ".paye-card",
    largeurs: [390, 1440]
  },
  "paye-filtre": {
    nav: "Paye",
    attendre: ".paye-card",
    largeurs: [1440],
    // Un seul financeur retenu : le total en tête doit suivre le filtre, sans
    // quoi l'officier citerait le montant de toute la garde à un seul Thane.
    async preparer(page) {
      await page.getByRole("button", { name: /^Thane de Rivebois/ }).first().click();
      await page.waitForFunction(
        () => document.querySelectorAll(".paye-card").length === 1
      );
    }
  },
  "paye-intendant": {
    nav: "Paye",
    attendre: ".paye-card",
    largeurs: [1440],
    reponses: { getSessionInfo: () => ({ role: "INTENDANT" }) }
  },
  prison: {
    nav: "Prison",
    attendre: ".prison-table",
    largeurs: [390, 1440]
  },
  inventaire: {
    nav: "Inventaire",
    attendre: ".inventaire-table",
    largeurs: [390, 1440],
    // Le formulaire « Ranger un objet » est replié par défaut : on le déplie,
    // pour que l'aperçu montre la recherche au catalogue et le choix du coffre.
    async preparer(page) {
      await page.getByRole("button", { name: "Déplier" }).click();
      await page.waitForSelector("#inventaire-coffre-ajout");
    }
  },
  "inventaire-intendant": {
    nav: "Inventaire",
    attendre: ".inventaire-table",
    largeurs: [1440],
    reponses: { getSessionInfo: () => ({ role: "INTENDANT" }) }
  },
  "prison-formulaire": {
    nav: "Prison",
    attendre: ".prison-table",
    largeurs: [390],
    async preparer(page) {
      await page.getByRole("button", { name: "+ Nouvelle incarcération" }).click();
      await page.waitForSelector(".form-card");
    }
  },
  amendes: {
    nav: "Amendes",
    attendre: ".registry-table",
    largeurs: [390, 1440]
  },
  // Formulaire d'amende avec une recherche de chef d'accusation en cours, pour
  // montrer les suggestions du Codex en mémoire et les jetons retenus.
  "amendes-formulaire": {
    nav: "Amendes",
    attendre: ".registry-table",
    largeurs: [1440],
    async preparer(page) {
      await page.getByRole("button", { name: "+ Nouvelle amende" }).click();
      await page.waitForSelector(".chefs-field");
      await page.locator(".chefs-field .saisie-shortcuts button").first().click();
      await page.locator("#chef-recherche").fill("refus");
      await page.waitForSelector("#chef-option-0");
    }
  },
  codex: {
    nav: "Codex",
    attendre: ".codex-list",
    largeurs: [390, 1440]
  },
  // Décrets de peines et amendes, limités au Corpus Juriscivilis : la page
  // entière, quelque 160 niveaux, donnerait une capture démesurée. Ces aperçus
  // lisent le Codex reconstitué depuis les textes, pour les vrais titres.
  peines: {
    nav: "Peines et amendes",
    attendre: ".peines-table",
    largeurs: [390, 1440],
    reponses: { getCodex: () => donnees.codexComplet },
    async preparer(page) {
      await page.selectOption("#peines-source", "Corpus Juriscivilis Imperialis");
      await page.waitForFunction(() => document.querySelectorAll(".peines-source").length === 1);
    }
  },
  // Mode d'emploi déplié : les échelons tels que la feuille les applique,
  // les règles de cumul et de récidive, la noblesse.
  "peines-principes": {
    nav: "Peines et amendes",
    attendre: ".peines-table",
    largeurs: [1440],
    reponses: { getCodex: () => donnees.codexComplet },
    async preparer(page) {
      await page.locator(".peines-principes summary").click();
      await page.locator("#peines-recherche").fill("harcèlement");
      await page.waitForFunction(() => document.querySelectorAll(".peines-article").length === 1);
    }
  },
  // Lecture d'un article avec son barème, la même popup que dans le Codex et
  // les registres.
  "peines-article": {
    nav: "Peines et amendes",
    attendre: ".peines-table",
    largeurs: [1440],
    reponses: { getCodex: () => donnees.codexComplet },
    async preparer(page) {
      await page.locator("#peines-recherche").fill("cpl 21");
      await page.locator(".peines-article-cellule .law-link").first().click();
      await page.waitForSelector(".law-bareme");
    }
  },
  // Formulaire d'amende : deux chefs, la requalification en crime retenue
  // pour le premier, proposition cumulée reportée dans le montant.
  "amendes-bareme": {
    nav: "Amendes",
    attendre: ".registry-table",
    largeurs: [390, 1440],
    reponses: { getCodex: () => donnees.codexComplet },
    async preparer(page) {
      await page.getByRole("button", { name: "+ Nouvelle amende" }).click();
      await page.waitForSelector(".chefs-field");
      for (const recherche of ["harcèlement moral", "cpl 16"]) {
        await page.locator("#chef-recherche").fill(recherche);
        await page.locator("#chef-option-0").click();
      }
      await page.waitForSelector(".bareme-chefs");
      await page.locator(".bareme-option").nth(1).click();
      await page.waitForFunction(() => document.querySelector("#sentence-valeur")?.value === "3150");
    }
  }
};

const demandes = process.argv.slice(2);
const aGenerer = demandes.length ? demandes : Object.keys(apercus);
for (const nom of aGenerer) {
  if (!apercus[nom]) {
    throw new Error(
      `Aperçu inconnu : ${nom}. Disponibles : ${Object.keys(apercus).join(", ")}.`
    );
  }
}

const html = await readFile(indexPath, "utf8");
const server = createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const navigateur = await chromium.launch({ channel: "msedge" });
const ecrits = [];
try {
  for (const nom of aGenerer) {
    const apercu = apercus[nom];
    for (const largeur of apercu.largeurs) {
      const context = await navigateur.newContext({
        viewport: { width: largeur, height: largeur < 600 ? 844 : 900 },
        deviceScaleFactor: 2,
        isMobile: largeur < 600,
        hasTouch: largeur < 600,
        locale: "fr-FR",
        timezoneId: "Europe/Stockholm"
      });
      const page = await context.newPage();

      // Installé avant tout script de la page, donc avant le bundle React.
      await page.addInitScript(
        ([table, jeton]) => {
          sessionStorage.setItem("guardAuthToken", jeton);
          const fabrique = () => {
            let succes = () => {};
            let echec = error => {
              throw error;
            };
            const run = new Proxy(
              {},
              {
                get(_, nomFonction) {
                  if (nomFonction === "withSuccessHandler") {
                    return handler => ((succes = handler), run);
                  }
                  if (nomFonction === "withFailureHandler") {
                    return handler => ((echec = handler), run);
                  }
                  return (...args) => {
                    setTimeout(() => {
                      if (!(nomFonction in table)) {
                        echec(
                          new Error(
                            `Aucune donnée d'aperçu pour ${String(nomFonction)}.`
                          )
                        );
                        return;
                      }
                      succes(table[nomFonction]);
                    }, 0);
                    void args;
                  };
                }
              }
            );
            return run;
          };
          Object.defineProperty(window, "google", {
            value: {
              script: {
                get run() {
                  return fabrique();
                }
              }
            },
            configurable: true
          });
        },
        [
          Object.fromEntries(
            Object.entries({ ...reponses, ...(apercu.reponses || {}) }).map(
              ([cle, valeur]) => [cle, valeur()]
            )
          ),
          "jeton-de-demonstration"
        ]
      );

      const erreurs = [];
      page.on("pageerror", erreur => erreurs.push(erreur.message));

      await page.goto(base, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: apercu.nav, exact: true }).click();
      await page.waitForSelector(apercu.attendre, { timeout: 15000 });
      if (apercu.preparer) await apercu.preparer(page);
      // Une saisie fait défiler la page ; les éléments fixes (barre latérale,
      // lien d'évitement) seraient alors peints décalés dans la capture pleine page.
      await page.evaluate(() => window.scrollTo(0, 0));
      // Laisse les images en data URL se peindre avant la capture.
      await page.waitForLoadState("networkidle");

      /*
        Sans cela, une capture prise juste après un clic fige un bouton au
        milieu de sa transition de couleur et donne à croire à un défaut de
        style. Les aperçus doivent montrer l'état final, et être reproductibles.
      */
      await page.addStyleTag({
        content: "*,*:before,*:after{transition:none!important;animation:none!important}"
      });

      if (erreurs.length) {
        throw new Error(`Erreurs JavaScript sur ${nom} : ${erreurs.join(" | ")}`);
      }

      const fichier = path.join(outDir, `${nom}-${largeur}.png`);
      await page.screenshot({ path: fichier, fullPage: true });
      ecrits.push(path.relative(rootDir, fichier));
      await context.close();
    }
  }
} finally {
  await navigateur.close();
  server.close();
}

console.log(`Aperçus générés :\n${ecrits.map(f => `  ${f}`).join("\n")}`);
