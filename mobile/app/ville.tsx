import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { lireFicheVille, listerEvenements, type FicheVille } from "../src/donnees/requetes.ts";
import { formaterPeriode } from "../src/domaine/sejour.ts";
import { champTraduit, traduire, LANGUE_INTERFACE } from "../src/domaine/traduction.ts";
import { useSession } from "../src/session.tsx";
import {
  Bloc,
  Chargement,
  Erreur,
  Etiquette,
  Paragraphe,
  SousTitre,
  Titre,
} from "../src/ui/composants.tsx";
import { couleurs, espaces } from "../src/ui/theme.ts";

type Evenement = Awaited<ReturnType<typeof listerEvenements>>[number];

interface AppRecommandee {
  nom?: string;
  categorie?: string;
}

const LIBELLES_URGENCE: Record<string, string> = {
  general: "Urgences",
  police: "Police",
  pompiers: "Pompiers",
  medical: "Urgences médicales",
};

export default function EcranVille() {
  const { ville, pays, debut, fin } = useLocalSearchParams<{
    ville: string;
    pays: string;
    debut?: string;
    fin?: string;
  }>();
  const { langue } = useSession();

  const [fiche, setFiche] = useState<FicheVille | null>(null);
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!ville || !pays) return;
    let vivant = true;

    void (async () => {
      try {
        const [f, e] = await Promise.all([
          lireFicheVille(ville, pays),
          // Sans dates de séjour, on montre les six mois à venir.
          listerEvenements(
            ville,
            pays,
            debut ?? new Date().toISOString().slice(0, 10),
            fin ?? new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
          ).catch(() => []),
        ]);
        if (!vivant) return;
        setFiche(f);
        setEvenements(e);
      } catch (err) {
        if (vivant) setErreur(err instanceof Error ? err.message : "Fiche ville indisponible.");
      } finally {
        if (vivant) setCharge(true);
      }
    })();

    return () => {
      vivant = false;
    };
  }, [ville, pays, debut, fin]);

  if (!charge && !erreur) return <Chargement libelle="Chargement de la fiche ville…" />;

  const urgences = (fiche?.numeros_urgence ?? {}) as Record<string, string>;
  const apps = Array.isArray(fiche?.apps_recommandees)
    ? (fiche.apps_recommandees as AppRecommandee[])
    : [];

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Titre>{ville}</Titre>
      <Erreur message={erreur} />

      {!fiche ? (
        <Paragraphe>
          Aucune fiche n'existe encore pour cette ville. Elle arrivera avec l'ouverture de la ville.
        </Paragraphe>
      ) : (
        <>
          <Bloc>
            <SousTitre>Se déplacer</SousTitre>
            {fiche.systeme_transport_nom ? (
              <Text style={styles.fort}>{fiche.systeme_transport_nom}</Text>
            ) : null}
            <Paragraphe>
              {traduire(fiche, "transport_description", langue, fiche.transport_description)}
            </Paragraphe>
          </Bloc>

          <Bloc>
            <SousTitre>Numéros d'urgence</SousTitre>
            {Object.entries(urgences).map(([cle, numero]) => (
              <Pressable
                key={cle}
                accessibilityRole="button"
                accessibilityLabel={`Appeler le ${numero}`}
                onPress={() => void Linking.openURL(`tel:${numero}`)}
                style={styles.ligneUrgence}
              >
                <Text style={styles.urgenceLibelle}>{LIBELLES_URGENCE[cle] ?? cle}</Text>
                <Text style={styles.urgenceNumero}>{numero}</Text>
              </Pressable>
            ))}
          </Bloc>

          {apps.length > 0 ? (
            <Bloc>
              <SousTitre>Applications utiles</SousTitre>
              <View style={styles.etiquettes}>
                {apps.map((app, i) => (
                  <Etiquette key={`${app.nom}-${i}`} texte={app.nom ?? "—"} />
                ))}
              </View>
            </Bloc>
          ) : null}
        </>
      )}

      {fiche ? (
        <Bloc>
          <SousTitre>Un événement manque ?</SousTitre>
          <Paragraphe>
            Proposez-le : il rejoindra la fiche une fois validé par la modération.
          </Paragraphe>
          <Link
            href={{
              pathname: "/evenement/nouveau",
              params: { cityGuideId: fiche.id, ville, pays },
            }}
            asChild
          >
            <Text style={styles.lien}>Proposer un événement →</Text>
          </Link>
        </Bloc>
      ) : null}

      {evenements.length > 0 ? (
        <>
          <SousTitre>Pendant votre séjour</SousTitre>
          {evenements.map((evenement) => (
            <Bloc key={evenement.id ?? evenement.titre}>
              <Text style={styles.fort}>{champTraduit(evenement, "titre", langue)}</Text>
              <Text style={styles.note}>
                {evenement.date_debut
                  ? formaterPeriode(evenement.date_debut, evenement.date_fin, LANGUE_INTERFACE)
                  : ""}
              </Text>
              <Paragraphe>
                {traduire(evenement, "description", langue, evenement.description)}
              </Paragraphe>
            </Bloc>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  fort: { fontSize: 15, fontWeight: "600", color: couleurs.texte, marginBottom: espaces.xs },
  note: { fontSize: 13, color: couleurs.texteAttenue, marginBottom: espaces.xs },
  etiquettes: { flexDirection: "row", flexWrap: "wrap", marginTop: espaces.s },
  ligneUrgence: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: espaces.s,
  },
  urgenceLibelle: { fontSize: 15, color: couleurs.texte },
  urgenceNumero: { fontSize: 16, fontWeight: "700", color: couleurs.accent },
  lien: { color: couleurs.accent, fontWeight: "600", marginTop: espaces.s, fontSize: 15 },
});
