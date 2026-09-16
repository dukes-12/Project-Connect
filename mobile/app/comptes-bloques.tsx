import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  debloquer,
  lireProfilPublic,
  listerMesBlocages,
  type ProfilPublic,
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
} from "../src/ui/composants.tsx";
import { espaces } from "../src/ui/theme.ts";

interface Bloque {
  userId: string;
  profil: ProfilPublic | null;
}

export default function EcranComptesBloques() {
  const moi = useUtilisateurId();

  const [bloques, setBloques] = useState<Bloque[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const lignes = await listerMesBlocages();
      // Le profil d'un compte bloqué n'est plus lisible via la vue publique —
      // elle exclut justement les blocages. On affiche donc ce qu'on peut.
      const avecProfils = await Promise.all(
        lignes.map(async (l) => ({
          userId: l.blocked_user_id,
          profil: await lireProfilPublic(l.blocked_user_id).catch(() => null),
        })),
      );
      setBloques(avecProfils);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Liste indisponible.");
      setBloques([]);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function retirer(userId: string) {
    if (!moi) return;
    setOccupe(userId);
    try {
      await debloquer(moi, userId);
      setBloques((precedents) => (precedents ?? []).filter((b) => b.userId !== userId));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Déblocage impossible.");
    } finally {
      setOccupe(null);
    }
  }

  if (!bloques && !erreur) return <Chargement libelle="Chargement…" />;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Paragraphe>
        Ces comptes ne peuvent pas vous écrire et n'apparaissent pas dans vos suggestions. Débloquer
        rétablit la conversation précédente, qui n'a jamais été supprimée.
      </Paragraphe>

      <Erreur message={erreur} />

      {bloques && bloques.length === 0 ? (
        <Paragraphe>Vous n'avez bloqué personne.</Paragraphe>
      ) : null}

      {(bloques ?? []).map(({ userId, profil }) => (
        <Bloc key={userId}>
          <View style={styles.ligne}>
            <Avatar chemin={profil?.photo_url} repli={profil?.bio} taille={44} />
            <View style={styles.texte}>
              <SousTitre>
                {profil?.age ? `${profil.age} ans` : "Compte bloqué"}
              </SousTitre>
              {profil?.bio ? <Text numberOfLines={1}>{profil.bio}</Text> : null}
            </View>
          </View>
          <Bouton
            variante="contour"
            titre="Débloquer"
            onPress={() => void retirer(userId)}
            occupe={occupe === userId}
            desactive={occupe !== null}
          />
        </Bloc>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  ligne: { flexDirection: "row", alignItems: "center", gap: espaces.m, marginBottom: espaces.s },
  texte: { flex: 1 },
});
