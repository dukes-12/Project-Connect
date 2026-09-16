import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { listerMesConversations, type Conversation } from "../src/donnees/requetes.ts";
import { Bloc, Chargement, Erreur, Paragraphe, SousTitre, Titre } from "../src/ui/composants.tsx";
import { couleurs, espaces } from "../src/ui/theme.ts";

export default function EcranConversations() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerMesConversations()
      .then(setConversations)
      .catch((e: unknown) => {
        setErreur(e instanceof Error ? e.message : "Conversations indisponibles.");
        setConversations([]);
      });
  }, []);

  if (!conversations && !erreur) return <Chargement libelle="Chargement des conversations…" />;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Titre>Messages</Titre>
      <Erreur message={erreur} />

      {conversations && conversations.length === 0 ? (
        <Paragraphe>
          Vos conversations s'ouvriront quand vous rejoindrez une cohorte ou qu'une proposition sera
          acceptée des deux côtés.
        </Paragraphe>
      ) : null}

      {(conversations ?? []).map((conversation) =>
        conversation.id ? (
          <Link key={conversation.id} href={`/conversation/${conversation.id}`} asChild>
            <Bloc>
              <SousTitre>
                {conversation.type === "groupe"
                  ? (conversation.description_groupe ?? "Cohorte")
                  : "Conversation"}
              </SousTitre>
              {conversation.dernier_message ? (
                <Text style={styles.apercu} numberOfLines={1}>
                  {conversation.dernier_message}
                </Text>
              ) : (
                <Text style={styles.note}>Aucun message pour l'instant</Text>
              )}
              <Text style={styles.note}>
                {conversation.type === "groupe"
                  ? `${conversation.nb_participants ?? 0} participants`
                  : ""}
                {conversation.dernier_message_at
                  ? `${conversation.type === "groupe" ? " · " : ""}${conversation.dernier_message_at.slice(0, 10)}`
                  : ""}
              </Text>
            </Bloc>
          </Link>
        ) : null,
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  apercu: { fontSize: 15, color: couleurs.texte, marginTop: espaces.xs },
  note: { fontSize: 13, color: couleurs.texteAttenue, marginTop: espaces.xs },
});
