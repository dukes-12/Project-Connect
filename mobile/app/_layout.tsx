import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FournisseurSession, useSession } from "../src/session.tsx";
import { Chargement } from "../src/ui/composants.tsx";
import { couleurs } from "../src/ui/theme.ts";

/**
 * Aiguillage : déconnecté → connexion, connecté sans profil → onboarding,
 * connecté avec profil → app. La redirection vit ici plutôt que dans chaque
 * écran, pour qu'il n'existe qu'un seul endroit où la règle est écrite.
 */
function Aiguillage() {
  const { session, profil, chargement } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (chargement) return;

    const premier = segments[0];
    const dansOnboarding = premier === "onboarding";
    const surConnexion = premier === "connexion";

    if (!session && !surConnexion) {
      router.replace("/connexion");
    } else if (session && !profil && !dansOnboarding) {
      router.replace("/onboarding/profil");
    } else if (session && profil && (surConnexion || dansOnboarding)) {
      router.replace("/");
    }
  }, [session, profil, chargement, segments, router]);

  if (chargement) return <Chargement libelle="Ouverture de la session…" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: couleurs.fond },
        headerShadowVisible: false,
        headerTintColor: couleurs.texte,
        contentStyle: { backgroundColor: couleurs.fond },
      }}
    />
  );
}

export default function DispositionRacine() {
  return (
    <SafeAreaProvider>
      <FournisseurSession>
        <StatusBar style="dark" />
        <Aiguillage />
      </FournisseurSession>
    </SafeAreaProvider>
  );
}
