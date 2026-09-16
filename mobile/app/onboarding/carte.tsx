import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { creerCarte, type TypeCarte } from "../../src/donnees/requetes.ts";
import { useSession } from "../../src/session.tsx";
import { Bouton, Champ, Erreur, Paragraphe, Titre } from "../../src/ui/composants.tsx";
import { couleurs, espaces, rayon } from "../../src/ui/theme.ts";

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

const TYPES: Array<{ type: TypeCarte; titre: string; description: string }> = [
  { type: "voyageur", titre: "Voyageur", description: "Je viens pour un séjour long." },
  { type: "travailleur", titre: "Travailleur", description: "Mobilité professionnelle, VIE, mission." },
  { type: "local", titre: "Local", description: "J'habite ici et j'accueille les arrivants." },
];

export default function EcranCarte() {
  const { session } = useSession();
  const router = useRouter();

  const [type, setType] = useState<TypeCarte>("voyageur");
  const [ville, setVille] = useState("");
  const [pays, setPays] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const avecDates = type !== "local";

  async function valider() {
    setErreur(null);
    const utilisateurId = session?.user.id;
    if (!utilisateurId) return setErreur("Session expirée, reconnectez-vous.");
    if (!ville.trim() || !pays.trim()) return setErreur("Ville et pays sont obligatoires.");

    if (avecDates) {
      if (!FORMAT_DATE.test(dateDebut)) {
        return setErreur("Date d'arrivée attendue au format AAAA-MM-JJ.");
      }
      if (dateFin && !FORMAT_DATE.test(dateFin)) {
        return setErreur("Date de départ attendue au format AAAA-MM-JJ, ou laissée vide.");
      }
      if (dateFin && dateFin <= dateDebut) {
        return setErreur("La date de départ doit suivre la date d'arrivée.");
      }
    }

    setOccupe(true);
    try {
      const carte = await creerCarte({
        user_id: utilisateurId,
        type,
        ville: ville.trim(),
        pays: pays.trim(),
        date_debut: avecDates ? dateDebut : null,
        date_fin: avecDates && dateFin ? dateFin : null,
        entreprise: type === "travailleur" && entreprise.trim() ? entreprise.trim() : null,
        est_principale: true,
        statut: "actif",
      });
      router.replace({ pathname: "/onboarding/interets", params: { carteId: carte.id } });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création de la carte impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Titre>Votre situation</Titre>
      <Paragraphe>
        Chaque projet de déplacement crée une carte. Vous pourrez en ajouter d'autres plus tard.
      </Paragraphe>

      <View style={styles.choix}>
        {TYPES.map((option) => {
          const actif = option.type === type;
          return (
            <Pressable
              key={option.type}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              onPress={() => setType(option.type)}
              style={[styles.option, actif && styles.optionActive]}
            >
              <Text style={[styles.optionTitre, actif && styles.optionTitreActif]}>{option.titre}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <Erreur message={erreur} />

      <Champ libelle="Ville" value={ville} onChangeText={setVille} placeholder="Lisbonne" />
      <Champ libelle="Pays" value={pays} onChangeText={setPays} placeholder="Portugal" />

      {avecDates ? (
        <>
          <Champ
            libelle="Date d'arrivée (AAAA-MM-JJ)"
            value={dateDebut}
            onChangeText={setDateDebut}
            placeholder="2027-03-15"
            keyboardType="numbers-and-punctuation"
          />
          <Champ
            libelle="Date de départ — laissez vide si le séjour est ouvert"
            value={dateFin}
            onChangeText={setDateFin}
            placeholder="2027-06-15"
            keyboardType="numbers-and-punctuation"
          />
        </>
      ) : null}

      {type === "travailleur" ? (
        <Champ
          libelle="Entreprise (facultatif, masquée par défaut)"
          value={entreprise}
          onChangeText={setEntreprise}
          placeholder="Acme SA"
        />
      ) : null}

      <Bouton titre="Continuer" onPress={() => void valider()} occupe={occupe} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.s },
  choix: { gap: espaces.s, marginVertical: espaces.m },
  option: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.m,
    padding: espaces.m,
    backgroundColor: couleurs.surface,
  },
  optionActive: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  optionTitre: { fontSize: 16, fontWeight: "600", color: couleurs.texte },
  optionTitreActif: { color: couleurs.accent },
  optionDescription: { fontSize: 14, color: couleurs.texteAttenue, marginTop: espaces.xs },
});
