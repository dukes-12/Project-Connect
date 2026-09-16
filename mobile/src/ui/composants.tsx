import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { couleurs, espaces, rayon } from "./theme.ts";

export function Titre({ children }: { children: ReactNode }) {
  return <Text style={styles.titre}>{children}</Text>;
}

export function SousTitre({ children }: { children: ReactNode }) {
  return <Text style={styles.sousTitre}>{children}</Text>;
}

export function Paragraphe({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraphe}>{children}</Text>;
}

export function Bloc({ children }: { children: ReactNode }) {
  return <View style={styles.bloc}>{children}</View>;
}

export function Etiquette({ texte, active = false }: { texte: string; active?: boolean }) {
  return (
    <View style={[styles.etiquette, active && styles.etiquetteActive]}>
      <Text style={[styles.etiquetteTexte, active && styles.etiquetteTexteActif]}>{texte}</Text>
    </View>
  );
}

export function Bouton({
  titre,
  onPress,
  variante = "plein",
  occupe = false,
  desactive = false,
}: {
  titre: string;
  onPress: () => void;
  variante?: "plein" | "contour";
  occupe?: boolean;
  desactive?: boolean;
}) {
  const inactif = desactive || occupe;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif, busy: occupe }}
      onPress={inactif ? undefined : onPress}
      style={({ pressed }) => [
        styles.bouton,
        variante === "contour" && styles.boutonContour,
        pressed && !inactif && styles.boutonPresse,
        inactif && styles.boutonInactif,
      ]}
    >
      {occupe ? (
        <ActivityIndicator color={variante === "plein" ? couleurs.surface : couleurs.accent} />
      ) : (
        <Text style={[styles.boutonTexte, variante === "contour" && styles.boutonTexteContour]}>
          {titre}
        </Text>
      )}
    </Pressable>
  );
}

export function Champ({ libelle, ...props }: { libelle: string } & TextInputProps) {
  return (
    <View style={styles.champ}>
      <Text style={styles.champLibelle}>{libelle}</Text>
      <TextInput
        accessibilityLabel={libelle}
        placeholderTextColor={couleurs.texteAttenue}
        style={styles.champSaisie}
        {...props}
      />
    </View>
  );
}

export function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.erreur} accessibilityLiveRegion="polite">
      <Text style={styles.erreurTexte}>{message}</Text>
    </View>
  );
}

export function Chargement({ libelle }: { libelle: string }) {
  return (
    <View style={styles.chargement}>
      <ActivityIndicator color={couleurs.accent} />
      <Text style={styles.paragraphe}>{libelle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 26, fontWeight: "700", color: couleurs.texte, marginBottom: espaces.s },
  sousTitre: { fontSize: 17, fontWeight: "600", color: couleurs.texte, marginBottom: espaces.s },
  paragraphe: { fontSize: 15, lineHeight: 22, color: couleurs.texteAttenue },
  bloc: {
    backgroundColor: couleurs.surface,
    borderColor: couleurs.bordure,
    borderWidth: 1,
    borderRadius: rayon.m,
    padding: espaces.m,
    marginBottom: espaces.m,
  },
  etiquette: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.l,
    paddingVertical: espaces.xs + 2,
    paddingHorizontal: espaces.m,
    marginRight: espaces.s,
    marginBottom: espaces.s,
    backgroundColor: couleurs.surface,
  },
  etiquetteActive: { backgroundColor: couleurs.accentDoux, borderColor: couleurs.accent },
  etiquetteTexte: { fontSize: 14, color: couleurs.texteAttenue },
  etiquetteTexteActif: { color: couleurs.accent, fontWeight: "600" },
  bouton: {
    backgroundColor: couleurs.accent,
    borderRadius: rayon.m,
    paddingVertical: espaces.m - 2,
    alignItems: "center",
    marginTop: espaces.s,
  },
  boutonContour: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: couleurs.accent,
  },
  boutonPresse: { opacity: 0.75 },
  boutonInactif: { opacity: 0.45 },
  boutonTexte: { color: couleurs.surface, fontSize: 16, fontWeight: "600" },
  boutonTexteContour: { color: couleurs.accent },
  champ: { marginBottom: espaces.m },
  champLibelle: { fontSize: 14, color: couleurs.texteAttenue, marginBottom: espaces.xs },
  champSaisie: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.s,
    paddingHorizontal: espaces.m - 4,
    paddingVertical: espaces.m - 4,
    fontSize: 16,
    color: couleurs.texte,
    backgroundColor: couleurs.surface,
  },
  erreur: {
    backgroundColor: couleurs.alerteDouce,
    borderRadius: rayon.s,
    padding: espaces.m - 4,
    marginBottom: espaces.m,
  },
  erreurTexte: { color: couleurs.alerte, fontSize: 14 },
  chargement: { flex: 1, alignItems: "center", justifyContent: "center", gap: espaces.m },
});
