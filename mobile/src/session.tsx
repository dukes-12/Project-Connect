/**
 * Session et langue de l'application.
 *
 * `profilComplet` distingue « connecté » de « prêt à utiliser l'app » : un
 * compte auth existe dès l'inscription, mais la ligne `public.users` (photo,
 * date de naissance, tranche d'âge) n'arrive qu'après l'onboarding. Le routage
 * s'appuie sur cette distinction.
 */

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NativeModules, Platform } from "react-native";

import { supabase, suivreCycleDeVie } from "./donnees/client.ts";
import { lireMonProfil, type Profil } from "./donnees/requetes.ts";
import { choisirLangue, type Langue } from "./domaine/traduction.ts";

interface ValeurSession {
  session: Session | null;
  profil: Profil | null;
  langue: Langue;
  chargement: boolean;
  rafraichirProfil: () => Promise<void>;
  seDeconnecter: () => Promise<void>;
}

const ContexteSession = createContext<ValeurSession | null>(null);

/** Langues de l'appareil, sans dépendance supplémentaire. */
function languesAppareil(): string[] {
  try {
    if (Platform.OS === "ios") {
      const reglages = NativeModules.SettingsManager?.settings;
      const liste = reglages?.AppleLanguages ?? [reglages?.AppleLocale].filter(Boolean);
      if (Array.isArray(liste) && liste.length > 0) return liste;
    }
    if (Platform.OS === "android") {
      const identifiant = NativeModules.I18nManager?.localeIdentifier;
      if (identifiant) return [identifiant];
    }
    const navigateur = globalThis.navigator as unknown as
      | { languages?: readonly string[]; language?: string }
      | undefined;
    if (navigateur?.languages?.length) return [...navigateur.languages];
    if (navigateur?.language) return [navigateur.language];
  } catch {
    // Un module natif absent ne doit pas empêcher l'app de démarrer.
  }
  return [];
}

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);

  const langue = useMemo(() => choisirLangue(languesAppareil()), []);

  const rafraichirProfil = useCallback(async () => {
    try {
      setProfil(await lireMonProfil());
    } catch {
      // Profil illisible (réseau, RLS) : on reste sur l'onboarding plutôt que
      // de bloquer l'app sur un écran d'erreur.
      setProfil(null);
    }
  }, []);

  useEffect(() => {
    let vivant = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!vivant) return;
      setSession(data.session);
      if (data.session) await rafraichirProfil();
      if (vivant) setChargement(false);
    });

    const { data: abonnement } = supabase.auth.onAuthStateChange(async (_evenement, nouvelle) => {
      setSession(nouvelle);
      if (nouvelle) {
        await rafraichirProfil();
      } else {
        setProfil(null);
      }
      setChargement(false);
    });

    const arreterCycleDeVie = suivreCycleDeVie();

    return () => {
      vivant = false;
      abonnement.subscription.unsubscribe();
      arreterCycleDeVie();
    };
  }, [rafraichirProfil]);

  const seDeconnecter = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const valeur = useMemo(
    () => ({ session, profil, langue, chargement, rafraichirProfil, seDeconnecter }),
    [session, profil, langue, chargement, rafraichirProfil, seDeconnecter],
  );

  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>;
}

export function useSession(): ValeurSession {
  const valeur = useContext(ContexteSession);
  if (!valeur) throw new Error("useSession doit être utilisé dans FournisseurSession");
  return valeur;
}

/** Identifiant du compte connecté, ou null. */
export function useUtilisateurId(): string | null {
  return useSession().session?.user.id ?? null;
}
