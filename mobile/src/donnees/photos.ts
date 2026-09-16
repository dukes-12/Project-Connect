/**
 * Photos de profil : sélection, téléversement, lecture.
 *
 * Le bucket `photos-profil` est privé — les policies y font respecter le
 * blocage. L'affichage passe donc par une URL signée, jamais par une URL
 * publique.
 */

import * as ImagePicker from "expo-image-picker";

import { decoderBase64 } from "../domaine/base64.ts";
import { supabase } from "./client.ts";

const BUCKET = "photos-profil";
/** Durée de validité d'une URL signée. Assez pour une session d'affichage. */
const VALIDITE_SIGNATURE_S = 60 * 60;

export interface PhotoChoisie {
  base64: string;
  typeMime: string;
  extension: string;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Ouvre la galerie. Rend `null` si la personne annule ou refuse l'accès.
 * `base64: true` évite de passer par le système de fichiers.
 */
export async function choisirPhoto(): Promise<PhotoChoisie | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const resultat = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    // Le bucket plafonne à 5 Mo : on compresse avant d'envoyer.
    quality: 0.7,
    base64: true,
  });

  if (resultat.canceled) return null;

  const image = resultat.assets[0];
  if (!image?.base64) return null;

  const typeMime = image.mimeType && EXTENSIONS[image.mimeType] ? image.mimeType : "image/jpeg";
  return { base64: image.base64, typeMime, extension: EXTENSIONS[typeMime] ?? "jpg" };
}

/**
 * Envoie la photo dans le dossier de l'utilisateur et rend son chemin.
 * Le premier segment du chemin doit être l'identifiant du compte : c'est ce que
 * vérifient les policies de storage.
 */
export async function televerserPhoto(utilisateurId: string, photo: PhotoChoisie): Promise<string> {
  const chemin = `${utilisateurId}/profil.${photo.extension}`;
  const octets = decoderBase64(photo.base64);

  const { error } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
    contentType: photo.typeMime,
    // Remplace la photo précédente plutôt que d'accumuler les fichiers.
    upsert: true,
  });
  if (error) throw new Error(`Envoi de la photo : ${error.message}`);

  return chemin;
}

/** URL signée pour afficher une photo. Rend null si le chemin est inaccessible. */
export async function urlSignee(chemin: string | null | undefined): Promise<string | null> {
  if (!chemin) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(chemin, VALIDITE_SIGNATURE_S);

  // Un échec ici est normal : photo pas encore envoyée, ou compte bloqué.
  // L'appelant affiche alors un repli plutôt qu'une erreur.
  if (error || !data) return null;
  return data.signedUrl;
}
