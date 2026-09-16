import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  activerCarte,
  creerSaCohorte,
  rejoindreCohorte,
  type GroupePropose,
} from "../src/donnees/requetes.ts";
import { formaterPeriode } from "../src/domaine/sejour.ts";
import { LANGUE_INTERFACE } from "../src/domaine/traduction.ts";
import {
  Bloc,
  Bouton,
  Chargement,
  Erreur,
  Paragraphe,
  SousTitre,
} from "../src/ui/composants.tsx";
import { couleurs, espaces } from "../src/ui/theme.ts";

export default function EcranCohorte() {
  const { carteId } = useLocalSearchParams<{ carteId: string }>();
  const router = useRouter();

  const [groupes, setGroupes] = useState<GroupePropose[] | null>(null);
  const [elargissement, setElargissement] = useState(0);
  const [dejaCree, setDejaCree] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!carteId) return setErreur("Carte introuvable.");
    setErreur(null);
    try {
      const resultat = await activerCarte(carteId);
      setGroupes(resultat.groupes);
      setElargissement(resultat.elargissement.groupes);
      setDejaCree(resultat.action === "groupe_cree");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Recherche de cohorte impossible.");
      setGroupes([]);
    }
  }, [carteId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function rejoindre(groupeId: string) {
    if (!carteId) return;
    setOccupe(groupeId);
    try {
      await rejoindreCohorte(carteId, groupeId);
      router.replace("/conversations");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de rejoindre cette cohorte.");
    } finally {
      setOccupe(null);
    }
  }

  async function creer() {
    if (!carteId) return;
    setOccupe("nouvelle");
    try {
      await creerSaCohorte(carteId);
      router.replace("/conversations");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création de la cohorte impossible.");
    } finally {
      setOccupe(null);
    }
  }

  if (!groupes && !erreur) return <Chargement libelle="Recherche de cohortes…" />;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Erreur message={erreur} />

      {dejaCree ? (
        <Bloc>
          <SousTitre>Cohorte créée</SousTitre>
          <Paragraphe>
            Personne n'arrivait encore à cette période : une cohorte a été ouverte à votre nom et
            vous l'avez rejointe. Les prochains arrivants la verront.
          </Paragraphe>
          <Bouton titre="Ouvrir le chat" onPress={() => router.replace("/conversations")} />
        </Bloc>
      ) : (
        <>
          <Paragraphe>
            {groupes && groupes.length > 0
              ? "Rejoignez un groupe existant, ou créez le vôtre."
              : "Aucune cohorte ne correspond pour l'instant."}
          </Paragraphe>

          {elargissement > 0 ? (
            <Text style={styles.note}>
              Recherche élargie à ±{elargissement} jours autour de votre arrivée.
            </Text>
          ) : null}

          {(groupes ?? []).map((groupe) => (
            <Bloc key={groupe.group_id}>
              <SousTitre>{groupe.description}</SousTitre>
              <Paragraphe>
                {groupe.nb_membres} membre{groupe.nb_membres > 1 ? "s" : ""} ·{" "}
                {formaterPeriode(groupe.fenetre_debut, groupe.fenetre_fin, LANGUE_INTERFACE)}
              </Paragraphe>
              {!groupe.meme_type ? (
                <Text style={styles.note}>Groupe d'un autre type de carte, mais aux mêmes dates.</Text>
              ) : null}
              <Bouton
                titre="Rejoindre"
                onPress={() => void rejoindre(groupe.group_id)}
                occupe={occupe === groupe.group_id}
                desactive={occupe !== null}
              />
            </Bloc>
          ))}

          <View style={styles.espace}>
            <Bouton
              variante="contour"
              titre="Créer ma propre cohorte"
              onPress={() => void creer()}
              occupe={occupe === "nouvelle"}
              desactive={occupe !== null}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  note: { fontSize: 13, color: couleurs.texteAttenue, fontStyle: "italic", marginTop: espaces.xs },
  espace: { marginTop: espaces.m },
});
