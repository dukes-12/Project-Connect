import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { supabase } from "../src/donnees/client.ts";
import { Bouton, Champ, Erreur, Paragraphe, Titre } from "../src/ui/composants.tsx";
import { couleurs, espaces } from "../src/ui/theme.ts";

type Mode = "connexion" | "inscription";

export default function EcranConnexion() {
  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function valider() {
    setErreur(null);
    setMessage(null);

    if (!email.includes("@")) return setErreur("Adresse e-mail invalide.");
    if (motDePasse.length < 8) return setErreur("Le mot de passe doit faire au moins 8 caractères.");

    setOccupe(true);
    try {
      const { error, data } =
        mode === "connexion"
          ? await supabase.auth.signInWithPassword({ email, password: motDePasse })
          : await supabase.auth.signUp({ email, password: motDePasse });

      if (error) {
        setErreur(error.message);
      } else if (mode === "inscription" && !data.session) {
        // Confirmation d'e-mail activée sur le projet.
        setMessage("Vérifiez votre boîte mail pour confirmer votre inscription.");
      }
      // En cas de succès avec session, l'aiguillage du layout prend le relais.
    } finally {
      setOccupe(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.plein}
    >
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <View>
          <Titre>Project-Connect</Titre>
          <Paragraphe>
            Rencontrez les personnes qui arrivent dans votre ville au même moment que vous.
          </Paragraphe>
        </View>

        <View style={styles.formulaire}>
          <Erreur message={erreur} />
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Champ
            libelle="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            placeholder="vous@exemple.fr"
          />
          <Champ
            libelle="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
            autoComplete={mode === "connexion" ? "current-password" : "new-password"}
            placeholder="8 caractères minimum"
          />

          <Bouton
            titre={mode === "connexion" ? "Se connecter" : "Créer mon compte"}
            onPress={() => void valider()}
            occupe={occupe}
          />
          <Bouton
            variante="contour"
            titre={mode === "connexion" ? "Je n'ai pas encore de compte" : "J'ai déjà un compte"}
            onPress={() => {
              setMode(mode === "connexion" ? "inscription" : "connexion");
              setErreur(null);
              setMessage(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { flexGrow: 1, justifyContent: "center", padding: espaces.l, gap: espaces.xl },
  formulaire: { gap: espaces.xs },
  message: { color: couleurs.accent, marginBottom: espaces.m, fontSize: 14 },
});
