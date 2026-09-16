/**
 * Blocage et signalement (§9.7).
 *
 * Deux actions de nature différente, volontairement distinctes à l'écran :
 * le blocage est immédiat et réversible par celui qui l'a posé ; le
 * signalement part en file de modération et n'a pas d'effet visible tout de
 * suite. Les confondre laisserait croire qu'un signalement fait taire l'autre.
 */

import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { bloquer, signaler } from "../donnees/requetes.ts";
import type { Enums } from "../donnees/database.types.ts";
import { Bouton, Erreur, Paragraphe, SousTitre } from "./composants.tsx";
import { couleurs, espaces, rayon } from "./theme.ts";

type Motif = Enums<"motif_signalement">;

const MOTIFS: Array<{ valeur: Motif; libelle: string }> = [
  { valeur: "harcelement", libelle: "Harcèlement" },
  { valeur: "contenu_inapproprie", libelle: "Contenu inapproprié" },
  { valeur: "faux_profil", libelle: "Faux profil" },
  { valeur: "comportement_deplace", libelle: "Comportement déplacé" },
  { valeur: "autre", libelle: "Autre" },
];

export interface ContexteModeration {
  conversationId?: string;
  messageId?: string;
}

export function FeuilleModeration({
  visible,
  onFermer,
  moi,
  cible,
  contexte,
  onBloque,
}: {
  visible: boolean;
  onFermer: () => void;
  moi: string | null;
  cible: string | null;
  contexte?: ContexteModeration;
  onBloque?: () => void;
}) {
  const [vue, setVue] = useState<"choix" | "signalement">("choix");
  const [motif, setMotif] = useState<Motif | null>(null);
  const [description, setDescription] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function reinitialiser() {
    setVue("choix");
    setMotif(null);
    setDescription("");
    setErreur(null);
    setConfirmation(null);
    setOccupe(false);
  }

  function fermer() {
    reinitialiser();
    onFermer();
  }

  async function confirmerBlocage() {
    if (!moi || !cible) return setErreur("Profil introuvable.");
    setOccupe(true);
    setErreur(null);
    try {
      await bloquer(moi, cible);
      onBloque?.();
      fermer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Blocage impossible.");
      setOccupe(false);
    }
  }

  async function envoyerSignalement() {
    if (!moi || !cible) return setErreur("Profil introuvable.");
    if (!motif) return setErreur("Choisissez un motif.");

    setOccupe(true);
    setErreur(null);
    try {
      await signaler(moi, cible, motif, description.trim(), contexte);
      setConfirmation(
        "Signalement transmis à la modération. Vous pouvez aussi bloquer ce compte si vous ne " +
          "voulez plus être contacté.",
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Signalement impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={fermer}>
      <Pressable style={styles.voile} onPress={fermer} accessibilityLabel="Fermer" />
      <View style={styles.feuille}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {confirmation ? (
            <>
              <SousTitre>Merci</SousTitre>
              <Paragraphe>{confirmation}</Paragraphe>
              <Bouton
                titre="Bloquer aussi ce compte"
                onPress={() => void confirmerBlocage()}
                occupe={occupe}
              />
              <Bouton variante="contour" titre="Fermer" onPress={fermer} />
            </>
          ) : vue === "choix" ? (
            <>
              <SousTitre>Signaler ou bloquer</SousTitre>
              <Erreur message={erreur} />

              <View style={styles.action}>
                <Text style={styles.actionTitre}>Bloquer</Text>
                <Paragraphe>
                  Effet immédiat : ce compte ne peut plus vous écrire, disparaît de vos suggestions
                  et votre conversation est masquée. Vous pourrez le débloquer quand vous voulez.
                </Paragraphe>
                <Bouton
                  titre="Bloquer ce compte"
                  onPress={() => void confirmerBlocage()}
                  occupe={occupe}
                />
              </View>

              <View style={styles.action}>
                <Text style={styles.actionTitre}>Signaler</Text>
                <Paragraphe>
                  Transmis à la modération, qui décidera. Sans effet immédiat sur vos échanges.
                </Paragraphe>
                <Bouton
                  variante="contour"
                  titre="Signaler ce compte"
                  onPress={() => setVue("signalement")}
                />
              </View>

              <Bouton variante="contour" titre="Annuler" onPress={fermer} />
            </>
          ) : (
            <>
              <SousTitre>Motif du signalement</SousTitre>
              <Erreur message={erreur} />

              <View style={styles.motifs}>
                {MOTIFS.map((option) => {
                  const actif = motif === option.valeur;
                  return (
                    <Pressable
                      key={option.valeur}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: actif }}
                      onPress={() => setMotif(option.valeur)}
                      style={[styles.motif, actif && styles.motifActif]}
                    >
                      <Text style={[styles.motifTexte, actif && styles.motifTexteActif]}>
                        {option.libelle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                accessibilityLabel="Description du signalement"
                value={description}
                onChangeText={setDescription}
                placeholder="Ce qui s'est passé (facultatif)"
                placeholderTextColor={couleurs.texteAttenue}
                style={styles.description}
                multiline
              />

              <Bouton
                titre="Envoyer le signalement"
                onPress={() => void envoyerSignalement()}
                occupe={occupe}
                desactive={!motif}
              />
              <Bouton variante="contour" titre="Retour" onPress={() => setVue("choix")} />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  feuille: {
    maxHeight: "80%",
    backgroundColor: couleurs.fond,
    borderTopLeftRadius: rayon.l,
    borderTopRightRadius: rayon.l,
    padding: espaces.l,
  },
  action: {
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.m,
    padding: espaces.m,
    marginVertical: espaces.s,
  },
  actionTitre: { fontSize: 16, fontWeight: "600", color: couleurs.texte, marginBottom: espaces.xs },
  motifs: { marginVertical: espaces.s, gap: espaces.s },
  motif: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.s,
    padding: espaces.m - 4,
    backgroundColor: couleurs.surface,
  },
  motifActif: { borderColor: couleurs.accent, backgroundColor: couleurs.accentDoux },
  motifTexte: { fontSize: 15, color: couleurs.texte },
  motifTexteActif: { color: couleurs.accent, fontWeight: "600" },
  description: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.s,
    padding: espaces.m - 4,
    minHeight: 80,
    fontSize: 15,
    color: couleurs.texte,
    backgroundColor: couleurs.surface,
    marginBottom: espaces.s,
  },
});
