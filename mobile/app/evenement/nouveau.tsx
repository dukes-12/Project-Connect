import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  chercherDoublonsEvenement,
  soumettreEvenement,
} from "../../src/donnees/requetes.ts";
import { aujourdhuiISO, formaterPeriode } from "../../src/domaine/sejour.ts";
import { LANGUE_INTERFACE } from "../../src/domaine/traduction.ts";
import {
  brouillonVide,
  LIBELLES_TYPE,
  TYPES_EVENEMENT,
  validerEvenement,
  type BrouillonEvenement,
  type EvenementValide,
  type TypeEvenement,
} from "../../src/domaine/soumission_evenement.ts";
import { useUtilisateurId } from "../../src/session.tsx";
import {
  Bloc,
  Bouton,
  Champ,
  Erreur,
  Paragraphe,
  SousTitre,
  Titre,
} from "../../src/ui/composants.tsx";
import { couleurs, espaces, rayon } from "../../src/ui/theme.ts";

type Doublon = Awaited<ReturnType<typeof chercherDoublonsEvenement>>[number];

export default function EcranNouvelEvenement() {
  const { cityGuideId, ville, pays } = useLocalSearchParams<{
    cityGuideId: string;
    ville: string;
    pays: string;
  }>();
  const moi = useUtilisateurId();
  const router = useRouter();

  const [brouillon, setBrouillon] = useState<BrouillonEvenement>(brouillonVide());
  const [doublons, setDoublons] = useState<Doublon[] | null>(null);
  const [valide, setValide] = useState<EvenementValide | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  function modifier(champ: keyof BrouillonEvenement, valeur: string) {
    setBrouillon((precedent) => ({ ...precedent, [champ]: valeur }));
    // Le formulaire a changé : la vérification précédente ne vaut plus.
    setDoublons(null);
    setValide(null);
  }

  /** §7.1 : la vérification de doublon est proposée AVANT la soumission. */
  async function verifier() {
    setErreur(null);
    const resultat = validerEvenement(brouillon, aujourdhuiISO());
    if (!resultat.ok) return setErreur(resultat.message);
    if (!ville || !pays) return setErreur("Ville inconnue.");

    setOccupe(true);
    try {
      const similaires = await chercherDoublonsEvenement(
        ville,
        pays,
        resultat.valeur.titre,
        resultat.valeur.dateDebut,
      );
      setValide(resultat.valeur);
      setDoublons(similaires);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Vérification impossible.");
    } finally {
      setOccupe(false);
    }
  }

  async function envoyer() {
    if (!valide || !cityGuideId || !moi) return;
    setOccupe(true);
    setErreur(null);
    try {
      await soumettreEvenement(cityGuideId, moi, valide);
      setEnvoye(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Soumission impossible.");
    } finally {
      setOccupe(false);
    }
  }

  if (envoye) {
    return (
      <ScrollView contentContainerStyle={styles.contenu}>
        <Titre>Merci</Titre>
        <Bloc>
          <SousTitre>{valide?.titre}</SousTitre>
          <Paragraphe>
            Votre événement part en modération. Il apparaîtra dans la fiche de {ville} une fois
            validé — vous le retrouverez d'ici là dans vos soumissions.
          </Paragraphe>
        </Bloc>
        <Bouton titre="Retour à la fiche ville" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Paragraphe>
        À {ville}. Votre proposition passe par la modération avant d'être visible.
      </Paragraphe>

      <Erreur message={erreur} />

      <Champ
        libelle="Titre"
        value={brouillon.titre}
        onChangeText={(t) => modifier("titre", t)}
        placeholder="Brocante de Alfama"
      />

      <Text style={styles.libelle}>Type</Text>
      <View style={styles.types}>
        {TYPES_EVENEMENT.map((type: TypeEvenement) => {
          const actif = brouillon.type === type;
          return (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              onPress={() => modifier("type", type)}
              style={[styles.type, actif && styles.typeActif]}
            >
              <Text style={[styles.typeTexte, actif && styles.typeTexteActif]}>
                {LIBELLES_TYPE[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Champ
        libelle="Date de début (AAAA-MM-JJ)"
        value={brouillon.dateDebut}
        onChangeText={(t) => modifier("dateDebut", t)}
        placeholder="2027-05-01"
        keyboardType="numbers-and-punctuation"
      />
      <Champ
        libelle="Date de fin — vide si l'événement dure un jour"
        value={brouillon.dateFin}
        onChangeText={(t) => modifier("dateFin", t)}
        placeholder="2027-05-02"
        keyboardType="numbers-and-punctuation"
      />
      <Champ
        libelle="Lien (facultatif)"
        value={brouillon.lien}
        onChangeText={(t) => modifier("lien", t)}
        placeholder="https://…"
        autoCapitalize="none"
        keyboardType="url"
      />
      <Champ
        libelle="Description courte (facultatif)"
        value={brouillon.description}
        onChangeText={(t) => modifier("description", t)}
        placeholder="Chinage tous les dimanches matin."
        multiline
        numberOfLines={3}
      />

      {doublons === null ? (
        <Bouton titre="Vérifier et continuer" onPress={() => void verifier()} occupe={occupe} />
      ) : (
        <>
          {doublons.length > 0 ? (
            <View style={styles.doublons}>
              <SousTitre>Événements déjà proposés</SousTitre>
              <Paragraphe>
                Ces entrées existent déjà à {ville} sur des dates proches. Si l'une correspond,
                inutile d'en ajouter une autre.
              </Paragraphe>
              {doublons.map((doublon) => (
                <Bloc key={doublon.id}>
                  <Text style={styles.doublonTitre}>{doublon.titre}</Text>
                  <Text style={styles.note}>
                    {formaterPeriode(doublon.date_debut, doublon.date_fin, LANGUE_INTERFACE)}
                    {doublon.statut_moderation === "en_attente" ? " · en attente de validation" : ""}
                  </Text>
                </Bloc>
              ))}
              <Bouton
                titre="Ce n'est pas un doublon, envoyer"
                onPress={() => void envoyer()}
                occupe={occupe}
              />
              <Bouton variante="contour" titre="Annuler" onPress={() => router.back()} />
            </View>
          ) : (
            <>
              <Text style={styles.note}>
                Aucun événement similaire trouvé à {ville} sur ces dates.
              </Text>
              <Bouton titre="Envoyer la proposition" onPress={() => void envoyer()} occupe={occupe} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  libelle: { fontSize: 14, color: couleurs.texteAttenue, marginBottom: espaces.xs },
  types: { flexDirection: "row", flexWrap: "wrap", gap: espaces.s, marginBottom: espaces.m },
  type: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.l,
    paddingVertical: espaces.s,
    paddingHorizontal: espaces.m,
    backgroundColor: couleurs.surface,
  },
  typeActif: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  typeTexte: { fontSize: 14, color: couleurs.texteAttenue },
  typeTexteActif: { color: couleurs.accent, fontWeight: "600" },
  doublons: { marginTop: espaces.m },
  doublonTitre: { fontSize: 15, fontWeight: "600", color: couleurs.texte },
  note: { fontSize: 13, color: couleurs.texteAttenue, marginVertical: espaces.s },
});
