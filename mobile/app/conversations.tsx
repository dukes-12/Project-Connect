import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { listerMesConversations } from "../src/donnees/requetes.ts";
import { Bloc, Chargement, Erreur, Paragraphe, SousTitre, Titre } from "../src/ui/composants.tsx";
import { couleurs, espaces } from "../src/ui/theme.ts";

type Conversation = Awaited<ReturnType<typeof listerMesConversations>>[number];

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

      {(conversations ?? []).map((conversation) => (
        <Link key={conversation.id} href={`/conversation/${conversation.id}`} asChild>
          <Bloc>
            <SousTitre>
              {conversation.type === "groupe" ? "Cohorte" : "Conversation"}
            </SousTitre>
            <Text style={styles.note}>Ouverte le {conversation.created_at.slice(0, 10)}</Text>
          </Bloc>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  note: { fontSize: 13, color: couleurs.texteAttenue, marginTop: espaces.xs },
});
