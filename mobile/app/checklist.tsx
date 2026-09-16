import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  lireAvancementChecklist,
  listerChecklist,
  marquerItemChecklist,
  type ItemChecklist,
} from "../src/donnees/requetes.ts";
import { champTraduit, traduire } from "../src/domaine/traduction.ts";
import { useSession, useUtilisateurId } from "../src/session.tsx";
import { Chargement, Erreur, Paragraphe, Titre } from "../src/ui/composants.tsx";
import { couleurs, espaces, rayon } from "../src/ui/theme.ts";

type Statut = "a_faire" | "en_cours" | "fait";

/** Un appui fait avancer l'item d'un cran, et revient à zéro après « fait ». */
const SUIVANT: Record<Statut, Statut> = {
  a_faire: "en_cours",
  en_cours: "fait",
  fait: "a_faire",
};

const MARQUE: Record<Statut, string> = { a_faire: "", en_cours: "…", fait: "✓" };

export default function EcranChecklist() {
  const { carteId, pays, ville } = useLocalSearchParams<{
    carteId: string;
    pays: string;
    ville: string;
  }>();
  const { langue } = useSession();
  const moi = useUtilisateurId();

  const [items, setItems] = useState<ItemChecklist[] | null>(null);
  const [statuts, setStatuts] = useState<Record<string, Statut>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!pays || !ville || !carteId) return setErreur("Carte incomplète.");
    try {
      const [liste, avancement] = await Promise.all([
        listerChecklist(pays, ville),
        lireAvancementChecklist(carteId),
      ]);
      setItems(liste);
      setStatuts(
        Object.fromEntries(avancement.map((a) => [a.checklist_item_id, a.statut as Statut])),
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Checklist indisponible.");
      setItems([]);
    }
  }, [pays, ville, carteId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function basculer(itemId: string) {
    if (!moi || !carteId) return;
    const suivant = SUIVANT[statuts[itemId] ?? "a_faire"];

    // Optimiste : l'appui doit répondre tout de suite. En cas d'échec on
    // revient à l'état précédent et on l'explique.
    const precedent = statuts;
    setStatuts({ ...statuts, [itemId]: suivant });
    try {
      await marquerItemChecklist(moi, carteId, itemId, suivant);
    } catch (e) {
      setStatuts(precedent);
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }

  if (!items && !erreur) return <Chargement libelle="Chargement de la checklist…" />;

  const faits = Object.values(statuts).filter((s) => s === "fait").length;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Paragraphe>
        {items && items.length > 0
          ? `${faits} sur ${items.length} — appuyez pour faire avancer.`
          : "Aucune démarche listée pour cette destination."}
      </Paragraphe>

      <Erreur message={erreur} />

      <View style={styles.liste}>
        {(items ?? []).map((item) => {
          const statut = statuts[item.id] ?? "a_faire";
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ checked: statut === "fait" }}
              accessibilityLabel={`${champTraduit(item, "titre", langue)}, ${statut}`}
              onPress={() => void basculer(item.id)}
              style={[styles.item, statut === "fait" && styles.itemFait]}
            >
              <View style={[styles.case, statut !== "a_faire" && styles.caseActive]}>
                <Text style={styles.marque}>{MARQUE[statut]}</Text>
              </View>
              <View style={styles.itemTexte}>
                <Text style={[styles.itemTitre, statut === "fait" && styles.itemTitreFait]}>
                  {champTraduit(item, "titre", langue)}
                </Text>
                <Paragraphe>{traduire(item, "description", langue, item.description)}</Paragraphe>
                {item.ville ? <Text style={styles.note}>Spécifique à {item.ville}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  liste: { marginTop: espaces.m, gap: espaces.s },
  item: {
    flexDirection: "row",
    gap: espaces.m,
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.m,
    padding: espaces.m,
  },
  itemFait: { backgroundColor: couleurs.accentDoux, borderColor: couleurs.accent },
  itemTexte: { flex: 1 },
  itemTitre: { fontSize: 16, fontWeight: "600", color: couleurs.texte, marginBottom: espaces.xs },
  itemTitreFait: { color: couleurs.accent },
  case: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    alignItems: "center",
    justifyContent: "center",
  },
  caseActive: { borderColor: couleurs.accent, backgroundColor: couleurs.surface },
  marque: { color: couleurs.accent, fontWeight: "700", fontSize: 14 },
  note: { fontSize: 12, color: couleurs.texteAttenue, marginTop: espaces.xs, fontStyle: "italic" },
});
