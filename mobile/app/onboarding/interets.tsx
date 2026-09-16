import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  activerCarte,
  definirHobbiesDeCarte,
  listerHobbies,
  type Hobby,
} from "../../src/donnees/requetes.ts";
import { champTraduit } from "../../src/domaine/traduction.ts";
import { useSession } from "../../src/session.tsx";
import {
  Bouton,
  Chargement,
  Erreur,
  Etiquette,
  Paragraphe,
  Titre,
} from "../../src/ui/composants.tsx";
import { couleurs, espaces } from "../../src/ui/theme.ts";

export default function EcranInterets() {
  const { carteId } = useLocalSearchParams<{ carteId: string }>();
  const { langue, rafraichirProfil } = useSession();
  const router = useRouter();

  const [hobbies, setHobbies] = useState<Hobby[] | null>(null);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerHobbies()
      .then(setHobbies)
      .catch((e: unknown) =>
        setErreur(e instanceof Error ? e.message : "Centres d'intérêt indisponibles."),
      );
  }, []);

  /** Regroupés par catégorie, dans la langue de l'appareil. */
  const parCategorie = useMemo(() => {
    const groupes = new Map<string, Hobby[]>();
    for (const hobby of hobbies ?? []) {
      const categorie = champTraduit(hobby, "categorie", langue);
      const liste = groupes.get(categorie) ?? [];
      liste.push(hobby);
      groupes.set(categorie, liste);
    }
    return [...groupes.entries()];
  }, [hobbies, langue]);

  function basculer(id: string) {
    setChoisis((precedents) => {
      const suivants = new Set(precedents);
      if (suivants.has(id)) suivants.delete(id);
      else suivants.add(id);
      return suivants;
    });
  }

  async function terminer() {
    setErreur(null);
    if (!carteId) return setErreur("Carte introuvable, reprenez l'étape précédente.");

    setOccupe(true);
    try {
      await definirHobbiesDeCarte(carteId, [...choisis]);
      // L'activation lance la recherche de cohorte et de profils (§8.1, §8.2).
      // Un échec ici ne doit pas bloquer l'entrée dans l'app : le matching sera
      // relançable depuis l'accueil.
      await activerCarte(carteId).catch(() => undefined);
      await rafraichirProfil();
      router.replace("/");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setOccupe(false);
    }
  }

  if (!hobbies && !erreur) return <Chargement libelle="Chargement des centres d'intérêt…" />;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Titre>Ce qui vous intéresse</Titre>
      <Paragraphe>
        Sert à vous proposer des personnes et des sorties. Vous pourrez en changer pour chaque
        séjour.
      </Paragraphe>

      <Erreur message={erreur} />

      {parCategorie.map(([categorie, liste]) => (
        <View key={categorie} style={styles.categorie}>
          <Text style={styles.categorieTitre}>{categorie}</Text>
          <View style={styles.etiquettes}>
            {liste.map((hobby) => (
              <Pressable
                key={hobby.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: choisis.has(hobby.id) }}
                onPress={() => basculer(hobby.id)}
              >
                <Etiquette texte={champTraduit(hobby, "nom", langue)} active={choisis.has(hobby.id)} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Bouton
        titre={choisis.size === 0 ? "Passer cette étape" : `Terminer (${choisis.size} choisis)`}
        onPress={() => void terminer()}
        occupe={occupe}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.s, paddingBottom: espaces.xl },
  categorie: { marginTop: espaces.m },
  categorieTitre: {
    fontSize: 15,
    fontWeight: "600",
    color: couleurs.texte,
    marginBottom: espaces.s,
  },
  etiquettes: { flexDirection: "row", flexWrap: "wrap" },
});
