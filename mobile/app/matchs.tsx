import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  lireCartePublique,
  listerMatchsEnAttente,
  repondreAuMatch,
  type CartePublique,
} from "../src/donnees/requetes.ts";
import { useUtilisateurId } from "../src/session.tsx";
import { Avatar } from "../src/ui/avatar.tsx";
import {
  Bloc,
  Bouton,
  Chargement,
  Erreur,
  Paragraphe,
  SousTitre,
  Titre,
} from "../src/ui/composants.tsx";
import { FeuilleModeration } from "../src/ui/feuille_moderation.tsx";
import { couleurs, espaces } from "../src/ui/theme.ts";

interface Proposition {
  id: string;
  score: number;
  profil: CartePublique | null;
}

export default function EcranMatchs() {
  const { carteId } = useLocalSearchParams<{ carteId: string }>();

  const moi = useUtilisateurId();
  const [propositions, setPropositions] = useState<Proposition[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [cibleModeration, setCibleModeration] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!carteId) return setErreur("Carte introuvable.");
    setErreur(null);
    try {
      const matchs = await listerMatchsEnAttente(carteId);
      // Les profils passent par la vue masquée : les champs que la personne a
      // choisi de cacher reviennent à null, y compris ici.
      const avecProfils = await Promise.all(
        matchs.map(async (m) => ({
          id: m.id,
          score: m.score,
          profil: await lireCartePublique(m.carteAutre).catch(() => null),
        })),
      );
      setPropositions(avecProfils);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement des propositions impossible.");
      setPropositions([]);
    }
  }, [carteId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function repondre(matchId: string, reponse: "accepte" | "refuse") {
    setOccupe(matchId);
    try {
      await repondreAuMatch(matchId, reponse);
      setPropositions((p) => (p ?? []).filter((prop) => prop.id !== matchId));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Réponse impossible.");
    } finally {
      setOccupe(null);
    }
  }

  if (!propositions && !erreur) return <Chargement libelle="Chargement des propositions…" />;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Titre>Propositions</Titre>
      <Erreur message={erreur} />

      <FeuilleModeration
        visible={cibleModeration !== null}
        onFermer={() => setCibleModeration(null)}
        moi={moi}
        cible={cibleModeration}
        onBloque={() => void charger()}
      />

      {propositions && propositions.length === 0 ? (
        <Paragraphe>
          Rien en attente. De nouvelles propositions apparaîtront à mesure que des personnes
          arrivent aux mêmes dates que vous.
        </Paragraphe>
      ) : null}

      {(propositions ?? []).map(({ id, score, profil }) => (
        <Bloc key={id}>
          <View style={styles.entete}>
            <Avatar chemin={profil?.photo_url} repli={profil?.bio} taille={48} />
            <View style={styles.enteteTexte}>
              <SousTitre>
                {profil?.age ? `${profil.age} ans` : "Profil"}
                {profil?.ville ? ` · ${profil.ville}` : ""}
              </SousTitre>
            </View>
            {profil?.user_id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Signaler ou bloquer ce profil"
                onPress={() => setCibleModeration(profil.user_id)}
                hitSlop={10}
              >
                <Text style={styles.signaler}>Signaler</Text>
              </Pressable>
            ) : null}
          </View>
          {profil?.bio ? <Paragraphe>{profil.bio}</Paragraphe> : null}
          {profil?.langues?.length ? (
            <Text style={styles.note}>Parle {profil.langues.join(", ")}</Text>
          ) : null}
          {profil?.date_debut ? (
            <Text style={styles.note}>
              Arrive le {profil.date_debut}
              {profil.date_fin ? `, repart le ${profil.date_fin}` : " (séjour ouvert)"}
            </Text>
          ) : null}
          <Text style={styles.note}>Affinité {Math.round(score * 100)} %</Text>

          <View style={styles.actions}>
            <View style={styles.moitie}>
              <Bouton
                titre="Passer"
                variante="contour"
                onPress={() => void repondre(id, "refuse")}
                desactive={occupe !== null}
              />
            </View>
            <View style={styles.moitie}>
              <Bouton
                titre="Accepter"
                onPress={() => void repondre(id, "accepte")}
                occupe={occupe === id}
                desactive={occupe !== null && occupe !== id}
              />
            </View>
          </View>
        </Bloc>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  note: { fontSize: 13, color: couleurs.texteAttenue, marginTop: espaces.xs },
  actions: { flexDirection: "row", gap: espaces.m, marginTop: espaces.s },
  moitie: { flex: 1 },
  entete: { flexDirection: "row", alignItems: "center", gap: espaces.m, marginBottom: espaces.s },
  enteteTexte: { flex: 1 },
  signaler: { color: couleurs.texteAttenue, fontSize: 13 },
});
