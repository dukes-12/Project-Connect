import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { urlSignee } from "../donnees/photos.ts";
import { couleurs } from "./theme.ts";

/**
 * Photo de profil. Le bucket étant privé, l'URL est signée à l'affichage.
 * Tant qu'aucune photo n'a été envoyée — ou si le compte est bloqué — on
 * affiche une pastille avec l'initiale plutôt qu'une image cassée.
 */
export function Avatar({
  chemin,
  repli,
  taille = 56,
}: {
  chemin: string | null | undefined;
  repli?: string | null;
  taille?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    setUrl(null);
    void urlSignee(chemin).then((u) => {
      if (vivant) setUrl(u);
    });
    return () => {
      vivant = false;
    };
  }, [chemin]);

  const dimensions = { width: taille, height: taille, borderRadius: taille / 2 };

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.image, dimensions]}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const initiale = (repli ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={[styles.repli, dimensions]}>
      <Text style={[styles.initiale, { fontSize: taille / 2.4 }]}>{initiale}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: couleurs.bordure },
  repli: { backgroundColor: couleurs.accentDoux, alignItems: "center", justifyContent: "center" },
  initiale: { color: couleurs.accent, fontWeight: "700" },
});
