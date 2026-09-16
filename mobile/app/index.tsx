import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  activerCarte,
  listerMatchsEnAttente,
  listerMesCartes,
  type Carte,
} from "../src/donnees/requetes.ts";
import { etatSejour, libelleEtatSejour, sejourEligibleAuMatching } from "../src/domaine/sejour.ts";
import { LANGUE_INTERFACE } from "../src/domaine/traduction.ts";
import { useSession } from "../src/session.tsx";
import {
  Bloc,
  Bouton,
  Chargement,
  Erreur,
  Paragraphe,
  SousTitre,
  Titre,
} from "../src/ui/composants.tsx";
import { couleurs, espaces } from "../src/ui/theme.ts";

export default function EcranAccueil() {
  const { seDeconnecter } = useSession();
  const router = useRouter();

  const [cartes, setCartes] = useState<Carte[] | null>(null);
  const [nbMatchs, setNbMatchs] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);
  const [relance, setRelance] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const mesCartes = await listerMesCartes();
      setCartes(mesCartes);

      const principale = mesCartes.find((c) => c.est_principale) ?? mesCartes[0];
      if (principale && sejourEligibleAuMatching(principale, principale.statut)) {
        setNbMatchs((await listerMatchsEnAttente(principale.id)).length);
      } else {
        setNbMatchs(0);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (!cartes && !erreur) return <Chargement libelle="Chargement de votre accueil…" />;

  const principale = cartes?.find((c) => c.est_principale) ?? cartes?.[0] ?? null;
  const autres = (cartes ?? []).filter((c) => c.id !== principale?.id);

  async function relancerMatching() {
    if (!principale) return;
    setRelance(true);
    try {
      await activerCarte(principale.id);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Relance du matching impossible.");
    } finally {
      setRelance(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.contenu}
      refreshControl={
        <RefreshControl
          refreshing={rafraichit}
          onRefresh={() => {
            setRafraichit(true);
            void charger().finally(() => setRafraichit(false));
          }}
        />
      }
    >
      <Erreur message={erreur} />

      {principale ? (
        <>
          <Titre>{principale.ville}</Titre>
          <Paragraphe>
            {libelleEtatSejour(etatSejour(principale), LANGUE_INTERFACE)}
            {principale.type === "travailleur" ? " · mobilité professionnelle" : ""}
          </Paragraphe>

          <View style={styles.espace} />

          <Bloc>
            <SousTitre>Votre cohorte</SousTitre>
            <Paragraphe>
              Les personnes qui arrivent à {principale.ville} au même moment que vous.
            </Paragraphe>
            <Link href={{ pathname: "/cohorte", params: { carteId: principale.id } }} asChild>
              <Text style={styles.lien}>Voir les cohortes →</Text>
            </Link>
          </Bloc>

          <Bloc>
            <SousTitre>
              {nbMatchs > 0 ? `${nbMatchs} profil${nbMatchs > 1 ? "s" : ""} à découvrir` : "Profils"}
            </SousTitre>
            <Paragraphe>
              {nbMatchs > 0
                ? "Des personnes avec un projet proche du vôtre attendent votre réponse."
                : "Aucune proposition en attente pour l'instant."}
            </Paragraphe>
            <Link href={{ pathname: "/matchs", params: { carteId: principale.id } }} asChild>
              <Text style={styles.lien}>Voir les propositions →</Text>
            </Link>
          </Bloc>

          <Bloc>
            <SousTitre>Messages</SousTitre>
            <Link href="/conversations" asChild>
              <Text style={styles.lien}>Ouvrir la messagerie →</Text>
            </Link>
          </Bloc>

          <Bloc>
            <SousTitre>S'installer</SousTitre>
            <Paragraphe>
              Les démarches à prévoir, et les repères de la ville.
            </Paragraphe>
            <Link
              href={{
                pathname: "/checklist",
                params: {
                  carteId: principale.id,
                  pays: principale.pays,
                  ville: principale.ville,
                },
              }}
              asChild
            >
              <Text style={styles.lien}>Ma checklist d'installation →</Text>
            </Link>
            <Link
              href={{
                pathname: "/ville",
                params: {
                  ville: principale.ville,
                  pays: principale.pays,
                  ...(principale.date_debut ? { debut: principale.date_debut } : {}),
                  ...(principale.date_fin ? { fin: principale.date_fin } : {}),
                },
              }}
              asChild
            >
              <Text style={styles.lien}>Fiche de {principale.ville} →</Text>
            </Link>
          </Bloc>

          <Bloc>
            <SousTitre>Locaux</SousTitre>
            <Paragraphe>
              Des habitants de {principale.ville} disponibles pour accueillir des arrivants.
            </Paragraphe>
            <Link
              href={{
                pathname: "/locaux",
                params: { ville: principale.ville, pays: principale.pays },
              }}
              asChild
            >
              <Text style={styles.lien}>Découvrir les locaux →</Text>
            </Link>
          </Bloc>

          {sejourEligibleAuMatching(principale, principale.statut) ? (
            <Bouton
              variante="contour"
              titre="Relancer la recherche"
              onPress={() => void relancerMatching()}
              occupe={relance}
            />
          ) : null}
        </>
      ) : (
        <Bloc>
          <SousTitre>Aucune carte active</SousTitre>
          <Paragraphe>Créez une carte pour lancer la recherche de cohorte.</Paragraphe>
          <Bouton titre="Créer une carte" onPress={() => router.push("/onboarding/carte")} />
        </Bloc>
      )}

      {autres.length > 0 ? (
        <View style={styles.espace}>
          <SousTitre>Vos autres cartes</SousTitre>
          {autres.map((carte) => (
            <Bloc key={carte.id}>
              <Text style={styles.carteTitre}>
                {carte.ville} · {carte.type}
              </Text>
              <Paragraphe>
                {carte.statut === "archive"
                  ? "Archivée"
                  : libelleEtatSejour(etatSejour(carte), LANGUE_INTERFACE)}
              </Paragraphe>
            </Bloc>
          ))}
        </View>
      ) : null}

      <Bloc>
        <SousTitre>Confidentialité</SousTitre>
        <Link href="/comptes-bloques" asChild>
          <Text style={styles.lien}>Comptes bloqués →</Text>
        </Link>
      </Bloc>

      <Bouton variante="contour" titre="Se déconnecter" onPress={() => void seDeconnecter()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espaces.l, paddingBottom: espaces.xl },
  espace: { marginTop: espaces.m },
  lien: { color: couleurs.accent, fontWeight: "600", marginTop: espaces.s, fontSize: 15 },
  carteTitre: { fontSize: 16, fontWeight: "600", color: couleurs.texte },
});
