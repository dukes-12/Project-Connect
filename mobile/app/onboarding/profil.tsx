import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { choisirPhoto, televerserPhoto, type PhotoChoisie } from "../../src/donnees/photos.ts";
import { creerMonProfil } from "../../src/donnees/requetes.ts";
import { useSession } from "../../src/session.tsx";
import { Avatar } from "../../src/ui/avatar.tsx";
import { Bouton, Champ, Erreur, Paragraphe, Titre } from "../../src/ui/composants.tsx";
import { couleurs, espaces } from "../../src/ui/theme.ts";

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function EcranProfil() {
  const { session, rafraichirProfil } = useSession();
  const router = useRouter();

  const [dateNaissance, setDateNaissance] = useState("");
  const [bio, setBio] = useState("");
  const [langues, setLangues] = useState("fr, en");
  const [ageMin, setAgeMin] = useState("25");
  const [ageMax, setAgeMax] = useState("45");
  const [sexeVisible, setSexeVisible] = useState(true);
  const [photo, setPhoto] = useState<PhotoChoisie | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function selectionnerPhoto() {
    setErreur(null);
    try {
      const choisie = await choisirPhoto();
      if (!choisie) {
        return setErreur("Aucune photo sélectionnée — l'accès à la galerie est peut-être refusé.");
      }
      setPhoto(choisie);
      setApercu(`data:${choisie.typeMime};base64,${choisie.base64}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Sélection de la photo impossible.");
    }
  }

  async function valider() {
    setErreur(null);
    const utilisateur = session?.user;
    if (!utilisateur) return setErreur("Session expirée, reconnectez-vous.");

    // §6.1 : la photo est obligatoire, c'est le minimum de confiance entre
    // personnes qui vont se rencontrer.
    if (!photo) return setErreur("Une photo de profil est nécessaire pour continuer.");

    if (!FORMAT_DATE.test(dateNaissance)) {
      return setErreur("Date de naissance attendue au format AAAA-MM-JJ.");
    }
    const min = Number(ageMin);
    const max = Number(ageMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 16 || max > 120 || min > max) {
      return setErreur("Tranche d'âge invalide : deux entiers entre 16 et 120, du plus petit au plus grand.");
    }

    setOccupe(true);
    try {
      // La photo part avant la ligne de profil : si l'envoi échoue, on n'a pas
      // créé un profil qui pointe vers un fichier inexistant.
      const cheminPhoto = await televerserPhoto(utilisateur.id, photo);

      await creerMonProfil({
        id: utilisateur.id,
        email: utilisateur.email ?? "",
        date_naissance: dateNaissance,
        age_min_prefere: min,
        age_max_prefere: max,
        bio: bio.trim() || null,
        langues: langues
          .split(",")
          .map((l) => l.trim().toLowerCase())
          .filter(Boolean),
        sexe_visible: sexeVisible,
        photo_url: cheminPhoto,
      });
      await rafraichirProfil();
      router.replace("/onboarding/carte");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création du profil impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Titre>Votre profil</Titre>
      <Paragraphe>
        Ces informations sont communes à toutes vos cartes. Votre âge est toujours visible ; le
        reste, vous choisissez.
      </Paragraphe>

      <View style={styles.formulaire}>
        <Erreur message={erreur} />

        <View style={styles.photo}>
          {apercu ? (
            <Image source={{ uri: apercu }} style={styles.apercu} accessibilityIgnoresInvertColors />
          ) : (
            <Avatar chemin={null} repli={session?.user.email} taille={88} />
          )}
          <View style={styles.photoTexte}>
            <Bouton
              variante="contour"
              titre={photo ? "Changer la photo" : "Choisir une photo"}
              onPress={() => void selectionnerPhoto()}
            />
            <Paragraphe>Obligatoire, et toujours visible des autres.</Paragraphe>
          </View>
        </View>

        <Champ
          libelle="Date de naissance (AAAA-MM-JJ)"
          value={dateNaissance}
          onChangeText={setDateNaissance}
          placeholder="1999-04-12"
          keyboardType="numbers-and-punctuation"
        />
        <Champ
          libelle="Quelques mots sur vous"
          value={bio}
          onChangeText={setBio}
          placeholder="VIE marketing, j'arrive à Lisbonne en mars."
          multiline
          numberOfLines={3}
        />
        <Champ
          libelle="Langues parlées (séparées par des virgules)"
          value={langues}
          onChangeText={setLangues}
          autoCapitalize="none"
        />

        <Text style={styles.section}>Tranche d'âge pour les mises en relation</Text>
        <Paragraphe>
          Sert de filtre dans les deux sens : elle n'apparaît pas sur votre profil.
        </Paragraphe>
        <View style={styles.ligne}>
          <View style={styles.moitie}>
            <Champ libelle="Minimum" value={ageMin} onChangeText={setAgeMin} keyboardType="number-pad" />
          </View>
          <View style={styles.moitie}>
            <Champ libelle="Maximum" value={ageMax} onChangeText={setAgeMax} keyboardType="number-pad" />
          </View>
        </View>

        <View style={styles.bascule}>
          <Text style={styles.basculeTexte}>Afficher mon sexe sur mon profil</Text>
          <Switch value={sexeVisible} onValueChange={setSexeVisible} />
        </View>

        <Bouton titre="Continuer" onPress={() => void valider()} occupe={occupe} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, gap: espaces.m },
  formulaire: { gap: espaces.xs },
  section: { fontSize: 16, fontWeight: "600", color: couleurs.texte, marginTop: espaces.m },
  ligne: { flexDirection: "row", gap: espaces.m },
  moitie: { flex: 1 },
  bascule: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: espaces.s,
  },
  basculeTexte: { fontSize: 15, color: couleurs.texte, flex: 1 },
  photo: { flexDirection: "row", alignItems: "center", gap: espaces.m, marginBottom: espaces.m },
  photoTexte: { flex: 1 },
  apercu: { width: 88, height: 88, borderRadius: 44 },
});
