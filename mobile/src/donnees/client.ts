/**
 * Client Supabase de l'application.
 *
 * La session est stockée dans SecureStore, découpée en fragments (voir
 * stockage_session.ts) : un jeton Supabase dépasse la limite de 2048 octets.
 */

import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

import {
  creerStockageFragmente,
  type MagasinClefValeur,
} from "../domaine/stockage_session.ts";
import type { Database } from "./database.types.ts";

const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CLE_PUBLIABLE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_SUPABASE || !CLE_PUBLIABLE) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définies. " +
      "Copiez .env.example en .env.",
  );
}

/**
 * Sur le web, SecureStore n'existe pas : on retombe sur localStorage, ce qui
 * convient au navigateur de développement mais pas à un déploiement web réel.
 */
const magasinNatif: MagasinClefValeur = {
  getItem: (cle) => SecureStore.getItemAsync(cle),
  setItem: (cle, valeur) => SecureStore.setItemAsync(cle, valeur),
  removeItem: (cle) => SecureStore.deleteItemAsync(cle),
};

const magasinWeb: MagasinClefValeur = {
  async getItem(cle) {
    return globalThis.localStorage?.getItem(cle) ?? null;
  },
  async setItem(cle, valeur) {
    globalThis.localStorage?.setItem(cle, valeur);
  },
  async removeItem(cle) {
    globalThis.localStorage?.removeItem(cle);
  },
};

export const supabase = createClient<Database>(URL_SUPABASE, CLE_PUBLIABLE, {
  auth: {
    storage: creerStockageFragmente(Platform.OS === "web" ? magasinWeb : magasinNatif),
    autoRefreshToken: true,
    persistSession: true,
    // Pas de session dans l'URL : l'app native passe par un lien profond.
    detectSessionInUrl: false,
  },
});

/**
 * Le rafraîchissement automatique doit suivre le cycle de vie de l'app :
 * laissé tourner en arrière-plan, il déclenche des requêtes inutiles et peut
 * faire expirer la session sur un réveil tardif.
 */
export function suivreCycleDeVie(): () => void {
  const abonnement = AppState.addEventListener("change", (etat) => {
    if (etat === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
  return () => abonnement.remove();
}
