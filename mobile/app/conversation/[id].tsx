import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ecouterMessages,
  envoyerMessage,
  listerMessages,
  type Message,
} from "../../src/donnees/requetes.ts";
import { useUtilisateurId } from "../../src/session.tsx";
import { Bouton, Chargement, Erreur } from "../../src/ui/composants.tsx";
import { couleurs, espaces, rayon } from "../../src/ui/theme.ts";

export default function EcranConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moi = useUtilisateurId();

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const liste = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!id) return;
    let vivant = true;

    listerMessages(id)
      .then((m) => vivant && setMessages(m))
      .catch((e: unknown) => {
        if (!vivant) return;
        setErreur(e instanceof Error ? e.message : "Messages indisponibles.");
        setMessages([]);
      });

    // Temps réel : la publication respecte la RLS, donc rien n'arrive d'une
    // conversation dont on n'est pas participant ni d'un compte bloqué.
    const arreter = ecouterMessages(id, (message) => {
      if (!vivant) return;
      setMessages((precedents) => {
        const liste = precedents ?? [];
        // L'envoi local ajoute déjà le message : on évite le doublon.
        if (liste.some((m) => m.id === message.id)) return liste;
        return [...liste, message];
      });
    });

    return () => {
      vivant = false;
      arreter();
    };
  }, [id]);

  async function envoyer() {
    const contenu = brouillon.trim();
    if (!contenu || !id || !moi) return;

    setEnvoi(true);
    setErreur(null);
    try {
      await envoyerMessage(id, moi, contenu);
      setBrouillon("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  if (!messages && !erreur) return <Chargement libelle="Ouverture de la conversation…" />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
      style={styles.plein}
    >
      <FlatList
        ref={liste}
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => liste.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const deMoi = item.sender_id === moi;
          return (
            <View style={[styles.bulle, deMoi ? styles.bulleMoi : styles.bulleAutre]}>
              <Text style={[styles.texte, deMoi && styles.texteMoi]}>{item.contenu}</Text>
              <Text style={[styles.heure, deMoi && styles.heureMoi]}>
                {item.created_at.slice(11, 16)}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.barre}>
        <Erreur message={erreur} />
        <View style={styles.saisieLigne}>
          <TextInput
            accessibilityLabel="Votre message"
            value={brouillon}
            onChangeText={setBrouillon}
            placeholder="Écrire un message…"
            placeholderTextColor={couleurs.texteAttenue}
            style={styles.saisie}
            multiline
          />
          <View style={styles.envoi}>
            <Bouton
              titre="Envoyer"
              onPress={() => void envoyer()}
              occupe={envoi}
              desactive={brouillon.trim().length === 0}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: couleurs.fond },
  messages: { padding: espaces.m, gap: espaces.s },
  bulle: { maxWidth: "80%", borderRadius: rayon.m, padding: espaces.m - 4 },
  bulleMoi: { alignSelf: "flex-end", backgroundColor: couleurs.accent },
  bulleAutre: {
    alignSelf: "flex-start",
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  texte: { fontSize: 15, color: couleurs.texte },
  texteMoi: { color: couleurs.surface },
  heure: { fontSize: 11, color: couleurs.texteAttenue, marginTop: espaces.xs },
  heureMoi: { color: couleurs.accentDoux },
  barre: {
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
    padding: espaces.m,
    backgroundColor: couleurs.surface,
  },
  saisieLigne: { flexDirection: "row", gap: espaces.s, alignItems: "flex-end" },
  saisie: {
    flex: 1,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.s,
    paddingHorizontal: espaces.m - 4,
    paddingVertical: espaces.s,
    maxHeight: 120,
    fontSize: 15,
    color: couleurs.texte,
  },
  envoi: { width: 110 },
});
