import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  demanderMiseEnRelation,
  listerLocaux,
  type LocalActif,
} from "../src/donnees/requetes.ts";
import { useUtilisateurId } from "../src/session.tsx";
import { Avatar } from "../src/ui/avatar.tsx";
import { FeuilleModeration } from "../src/ui/feuille_moderation.tsx";
import {
  Bloc,
  Bouton,
  Chargement,
  Erreur,
  Etiquette,
  Paragraphe,
  SousTitre,
  Titre,
} from "../src/ui/composants.tsx";
import { couleurs, espaces, rayon } from "../src/ui/theme.ts";

export default function EcranLocaux() {
  const { ville, pays } = useLocalSearchParams<{ ville: string; pays: string }>();
  const moi = useUtilisateurId();

  const [locaux, setLocaux] = useState<LocalActif[] | null>(null);
  const [filtre, setFiltre] = useState("");
  const [demandes, setDemandes] = useState<Set<string>>(new Set());
  const [intro, setIntro] = useState<Record<string, string>>({});
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cibleModeration, setCibleModeration] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!ville || !pays) return setErreur("Ville inconnue.");
    try {
      setLocaux(await listerLocaux(ville, pays));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Locaux indisponibles.");
      setLocaux([]);
    }
  }, [ville, pays]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Filtre côté client sur les intérêts et les langues (§8.3). */
  const filtres = useMemo(() => {
    const terme = filtre.trim().toLowerCase();
    if (!terme) return locaux ?? [];
    return (locaux ?? []).filter((local) => {
      const champs = [...(local.hobbies ?? []), ...(local.langues ?? []), local.bio ?? ""];
      return champs.some((c) => c.toLowerCase().includes(terme));
    });
  }, [locaux, filtre]);

  async function demander(local: LocalActif) {
    if (!moi || !local.user_id) return;
    setOccupe(local.user_id);
    setErreur(null);
    try {
      await demanderMiseEnRelation(
        local.user_id,
        moi,
        intro[local.user_id]?.trim() || "Bonjour, j'arrive bientôt et j'aimerais échanger.",
      );
      setDemandes((d) => new Set(d).add(local.user_id!));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Demande impossible.");
    } finally {
      setOccupe(null);
    }
  }

  if (!locaux && !erreur) return <Chargement libelle="Recherche des locaux…" />;

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Titre>Locaux à {ville}</Titre>
      <Paragraphe>
        Des habitants qui se sont rendus disponibles pour accueillir des nouveaux arrivants.
      </Paragraphe>

      <TextInput
        accessibilityLabel="Filtrer par intérêt ou par langue"
        value={filtre}
        onChangeText={setFiltre}
        placeholder="Filtrer : surf, portugais, cuisine…"
        placeholderTextColor={couleurs.texteAttenue}
        style={styles.filtre}
        autoCapitalize="none"
      />

      <Erreur message={erreur} />

      <FeuilleModeration
        visible={cibleModeration !== null}
        onFermer={() => setCibleModeration(null)}
        moi={moi}
        cible={cibleModeration}
        onBloque={() => void charger()}
      />

      {filtres.length === 0 ? (
        <Paragraphe>
          {locaux && locaux.length > 0
            ? "Aucun local ne correspond à ce filtre."
            : "Personne ne s'est encore déclaré local dans cette ville."}
        </Paragraphe>
      ) : null}

      {filtres.map((local) => {
        const demande = local.user_id ? demandes.has(local.user_id) : false;
        return (
          <Bloc key={local.card_id ?? local.user_id}>
            <View style={styles.entete}>
              <Avatar chemin={local.photo_url} repli={local.bio} taille={52} />
              <View style={styles.enteteTexte}>
                <SousTitre>
                  {local.age ? `${local.age} ans` : "Local"}
                  {local.quartier_precis ? ` · ${local.quartier_precis}` : ""}
                </SousTitre>
                {local.langues?.length ? (
                  <Text style={styles.note}>Parle {local.langues.join(", ")}</Text>
                ) : null}
              </View>
              {local.user_id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Signaler ou bloquer ce profil"
                  onPress={() => setCibleModeration(local.user_id)}
                  hitSlop={10}
                >
                  <Text style={styles.signaler}>Signaler</Text>
                </Pressable>
              ) : null}
            </View>

            {local.bio ? <Paragraphe>{local.bio}</Paragraphe> : null}

            {local.hobbies?.length ? (
              <View style={styles.etiquettes}>
                {local.hobbies.map((hobby) => (
                  <Etiquette key={hobby} texte={hobby} />
                ))}
              </View>
            ) : null}

            {demande ? (
              <Text style={styles.envoyee}>Demande envoyée — à eux de répondre.</Text>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Message d'introduction"
                  value={local.user_id ? (intro[local.user_id] ?? "") : ""}
                  onChangeText={(t) =>
                    local.user_id && setIntro((precedent) => ({ ...precedent, [local.user_id!]: t }))
                  }
                  placeholder="Un mot pour vous présenter…"
                  placeholderTextColor={couleurs.texteAttenue}
                  style={styles.intro}
                  multiline
                />
                <Bouton
                  titre="Demander à échanger"
                  onPress={() => void demander(local)}
                  occupe={occupe === local.user_id}
                  desactive={occupe !== null}
                />
              </>
            )}
          </Bloc>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  filtre: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.s,
    paddingHorizontal: espaces.m - 4,
    paddingVertical: espaces.s + 2,
    marginVertical: espaces.m,
    fontSize: 15,
    color: couleurs.texte,
    backgroundColor: couleurs.surface,
  },
  entete: { flexDirection: "row", gap: espaces.m, alignItems: "center", marginBottom: espaces.s },
  enteteTexte: { flex: 1 },
  note: { fontSize: 13, color: couleurs.texteAttenue },
  etiquettes: { flexDirection: "row", flexWrap: "wrap", marginTop: espaces.s },
  intro: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.s,
    paddingHorizontal: espaces.m - 4,
    paddingVertical: espaces.s,
    marginTop: espaces.s,
    minHeight: 60,
    fontSize: 15,
    color: couleurs.texte,
  },
  envoyee: { color: couleurs.accent, fontWeight: "600", marginTop: espaces.s },
  signaler: { color: couleurs.texteAttenue, fontSize: 13 },
});
