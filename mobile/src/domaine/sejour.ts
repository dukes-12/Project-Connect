/**
 * État d'un séjour par rapport à aujourd'hui, et libellés associés.
 *
 * Mêmes règles de dates que l'edge function de matching : tout en UTC, format
 * `YYYY-MM-DD`, jamais de `new Date("...")` interprété en heure locale — sans
 * quoi un séjour démarrant demain s'affiche « aujourd'hui » à l'ouest de
 * Greenwich. Les quelques lignes de calcul sont redites ici plutôt que
 * partagées : Metro ne résout pas les imports hors du dossier de l'app.
 */

import type { Langue } from "./traduction.ts";

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PAR_JOUR = 86_400_000;

export function enJoursUTC(iso: string): number {
  if (!FORMAT_DATE.test(iso)) {
    throw new Error(`Date attendue au format YYYY-MM-DD, reçu : ${iso}`);
  }
  const [annee, mois, jour] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) {
    throw new Error(`Date inexistante : ${iso}`);
  }
  return Math.floor(d.getTime() / MS_PAR_JOUR);
}

export function joursEntre(depuis: string, jusqua: string): number {
  return enJoursUTC(jusqua) - enJoursUTC(depuis);
}

export function aujourdhuiISO(maintenant = new Date()): string {
  return maintenant.toISOString().slice(0, 10);
}

export interface Sejour {
  type: "local" | "voyageur" | "travailleur";
  date_debut: string | null;
  date_fin: string | null;
}

export type EtatSejour =
  | { etat: "sans_dates" }
  | { etat: "a_venir"; joursAvant: number }
  | { etat: "en_cours"; joursRestants: number | null }
  | { etat: "termine"; joursDepuis: number };

export function etatSejour(sejour: Sejour, aujourdhui = aujourdhuiISO()): EtatSejour {
  if (sejour.type === "local" || !sejour.date_debut) return { etat: "sans_dates" };

  const avantArrivee = joursEntre(aujourdhui, sejour.date_debut);
  if (avantArrivee > 0) return { etat: "a_venir", joursAvant: avantArrivee };

  if (sejour.date_fin) {
    const restants = joursEntre(aujourdhui, sejour.date_fin);
    // La date de fin est le dernier jour du séjour : on est encore « en cours »
    // le jour même du départ.
    if (restants < 0) return { etat: "termine", joursDepuis: -restants };
    return { etat: "en_cours", joursRestants: restants };
  }

  // Séjour ouvert : en cours, sans échéance.
  return { etat: "en_cours", joursRestants: null };
}

const LIBELLES: Record<Langue, Record<string, (n: number) => string>> = {
  fr: {
    a_venir: (n) => (n === 1 ? "Arrivée demain" : `Arrivée dans ${n} jours`),
    en_cours_avec_fin: (n) =>
      n === 0 ? "Dernier jour" : n === 1 ? "Départ demain" : `Encore ${n} jours`,
    termine: (n) => (n === 1 ? "Terminé hier" : `Terminé il y a ${n} jours`),
  },
  en: {
    a_venir: (n) => (n === 1 ? "Arriving tomorrow" : `Arriving in ${n} days`),
    en_cours_avec_fin: (n) =>
      n === 0 ? "Last day" : n === 1 ? "Leaving tomorrow" : `${n} days left`,
    termine: (n) => (n === 1 ? "Ended yesterday" : `Ended ${n} days ago`),
  },
};

const SANS_NOMBRE: Record<Langue, { sur_place: string; sans_dates: string }> = {
  fr: { sur_place: "Sur place", sans_dates: "Sur place" },
  en: { sur_place: "Here now", sans_dates: "Here now" },
};

export function libelleEtatSejour(etat: EtatSejour, langue: Langue): string {
  switch (etat.etat) {
    case "a_venir":
      return LIBELLES[langue].a_venir(etat.joursAvant);
    case "en_cours":
      return etat.joursRestants === null
        ? SANS_NOMBRE[langue].sur_place
        : LIBELLES[langue].en_cours_avec_fin(etat.joursRestants);
    case "termine":
      return LIBELLES[langue].termine(etat.joursDepuis);
    case "sans_dates":
      return SANS_NOMBRE[langue].sans_dates;
  }
}

/** Une carte peut-elle encore participer au matching ? (miroir de la règle serveur) */
export function sejourEligibleAuMatching(
  sejour: Sejour,
  statut: "actif" | "inactif" | "archive",
): boolean {
  return sejour.type !== "local" && statut === "actif" && Boolean(sejour.date_debut);
}
