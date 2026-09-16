/**
 * Réponses factices pour le test de fumée.
 *
 * Elles imitent ce que PostgREST renverrait, afin de rendre chaque écran hors
 * ligne. Ce sont des données de démonstration : elles ne valident pas les
 * requêtes SQL — ça, c'est fait côté base — mais elles permettent de voir les
 * écrans s'afficher avec du contenu plausible.
 */

export const UTILISATEUR = {
  id: "11111111-1111-4111-8111-000000000001",
  email: "alice@exemple.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-09-01T00:00:00Z",
};

export const SESSION = {
  access_token: "jeton-factice",
  refresh_token: "rafraichissement-factice",
  token_type: "bearer",
  // Loin dans le futur : supabase-js ne tentera pas de rafraîchir.
  expires_at: 4102444800,
  expires_in: 3600,
  user: UTILISATEUR,
};

const PROFIL = {
  id: UTILISATEUR.id,
  email: UTILISATEUR.email,
  langues: ["fr", "en"],
  bio: "VIE marketing, j'arrive à Lisbonne en mars.",
  photo_url: `${UTILISATEUR.id}/profil.jpg`,
  date_naissance: "1999-04-12",
  age_min_prefere: 25,
  age_max_prefere: 45,
  sexe: "femme",
  sexe_visible: true,
  religion: null,
  religion_visible: false,
  nationalites: ["FR"],
  nationalites_visible: true,
  origines: [],
  origines_visible: false,
  consentement_sensibles_at: "2026-09-01T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const CARTE = {
  id: "22222222-2222-4222-8222-000000000001",
  user_id: UTILISATEUR.id,
  type: "voyageur",
  ville: "Lisbonne",
  pays: "Portugal",
  ville_place_id: null,
  date_debut: "2027-03-15",
  date_fin: "2027-06-15",
  statut: "actif",
  est_principale: true,
  quartier_precis: "Alfama",
  quartier_visible: true,
  entreprise: null,
  entreprise_visible: false,
  sejour: "[2027-03-15,2027-06-15)",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const HOBBIES = [
  ["Surf", "Plein air", "Surfing", "Outdoors"],
  ["Cafés", "Gastronomie", "Coffee shops", "Food & drink"],
  ["Musées", "Culture", "Museums", "Culture"],
  ["Tech / développement", "Professionnel", "Tech & coding", "Professional"],
  ["Cuisine", "Gastronomie", "Cooking", "Food & drink"],
  ["Randonnée", "Plein air", "Hiking", "Outdoors"],
].map(([nom, categorie, nomEn, catEn], i) => ({
  id: `hobby-${i}`,
  nom,
  categorie,
  icone: null,
  traductions: { en: { nom: nomEn, categorie: catEn } },
}));

const FICHE_VILLE = {
  id: "ville-lisbonne",
  ville: "Lisbonne",
  pays: "Portugal",
  ville_place_id: null,
  systeme_transport_nom: "Carris / Metro de Lisboa",
  transport_description:
    "Métro (4 lignes), bus et tramways Carris. Carte rechargeable Navegante à acheter en station.",
  apps_recommandees: [
    { nom: "Carris/Metro", categorie: "transport" },
    { nom: "Bolt", categorie: "vtc" },
    { nom: "Revolut", categorie: "banque" },
  ],
  numeros_urgence: { general: "112", police: "112", pompiers: "112", medical: "112" },
  traductions: {},
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const EVENEMENTS = [
  {
    id: "evt-1",
    city_guide_id: FICHE_VILLE.id,
    ville: "Lisbonne",
    pays: "Portugal",
    titre: "Festas de Lisboa",
    type: "festival",
    date_debut: "2027-06-01",
    date_fin: "2027-06-30",
    periode: "[2027-06-01,2027-06-30]",
    lien: null,
    description: "Un mois de fêtes de quartier, sardines et marches populaires.",
    source: "agrege",
    traductions: {},
  },
];

const CHECKLIST = [
  ["Obtenir un NIF", "Numéro fiscal portugais, exigé pour un bail et une banque.", null],
  ["Ouvrir un compte bancaire", "Un IBAN local facilite loyer et prélèvements.", null],
  ["Carte Navegante", "Carte de transport rechargeable, en station de métro.", "Lisbonne"],
].map(([titre, description, ville], i) => ({
  id: `check-${i}`,
  pays: "Portugal",
  ville,
  titre,
  description,
  ordre: i,
  traductions: {},
  created_at: "2026-09-01T00:00:00Z",
}));

const LOCAUX = [
  {
    card_id: "carte-emma",
    user_id: "11111111-1111-4111-8111-000000000005",
    ville: "Lisbonne",
    pays: "Portugal",
    quartier_precis: "Graça",
    photo_url: "11111111-1111-4111-8111-000000000005/profil.jpg",
    bio: "Lisboète, contente d'accueillir des nouveaux arrivants.",
    langues: ["pt", "en", "fr"],
    age: 40,
    sexe: "femme",
    hobbies: ["Cafés", "Cuisine", "Histoire locale", "Marchés locaux"],
  },
];

const CONVERSATIONS = [
  {
    id: "conv-groupe",
    type: "groupe",
    matching_group_id: "groupe-1",
    created_at: "2026-09-10T10:00:00Z",
    description_groupe: "Arrivées à Lisbonne — mi-mars 2027",
    autre_user_id: null,
    nb_participants: 4,
    dernier_message_at: "2026-09-15T18:30:00Z",
    dernier_message: "Quelqu'un pour un café la première semaine ?",
  },
  {
    id: "conv-directe",
    type: "direct",
    matching_group_id: null,
    created_at: "2026-09-12T10:00:00Z",
    description_groupe: null,
    autre_user_id: "11111111-1111-4111-8111-000000000002",
    nb_participants: 2,
    dernier_message_at: "2026-09-14T09:12:00Z",
    dernier_message: "Je débarque le 15, on se cale un truc ?",
  },
];

const MESSAGES = [
  {
    id: "msg-1",
    conversation_id: "conv-groupe",
    sender_id: "11111111-1111-4111-8111-000000000002",
    contenu: "Salut ! J'atterris le 10 mars, quelqu'un pour un café la première semaine ?",
    created_at: "2026-09-15T18:20:00Z",
  },
  {
    id: "msg-2",
    conversation_id: "conv-groupe",
    sender_id: UTILISATEUR.id,
    contenu: "Avec plaisir, je suis à Alfama.",
    created_at: "2026-09-15T18:30:00Z",
  },
];

const MATCHS = [
  {
    id: "match-1",
    card_id_a: CARTE.id,
    card_id_b: "carte-bruno",
    decision_a: "en_attente",
    decision_b: "en_attente",
    score: 0.5783,
    statut: "propose",
  },
];

const CARTE_PUBLIQUE = {
  card_id: "carte-bruno",
  user_id: "11111111-1111-4111-8111-000000000002",
  type: "travailleur",
  ville: "Lisbonne",
  pays: "Portugal",
  date_debut: "2027-03-15",
  date_fin: "2027-09-15",
  statut: "actif",
  quartier_precis: null,
  entreprise: null,
  photo_url: "11111111-1111-4111-8111-000000000002/profil.jpg",
  bio: "Détaché six mois par mon entreprise.",
  langues: ["fr", "pt", "en"],
  age: 30,
  sexe: "homme",
};

const ACTIVATION = {
  action: "groupes_proposes",
  groupes: [
    {
      group_id: "groupe-1",
      description: "Arrivées à Lisbonne — mi-mars 2027",
      fenetre_debut: "2027-03-01",
      fenetre_fin: "2027-03-29",
      meme_type: true,
      nb_membres: 4,
    },
    {
      group_id: "groupe-2",
      description: "Arrivées à Lisbonne — début avril 2027",
      fenetre_debut: "2027-03-18",
      fenetre_fin: "2027-04-15",
      meme_type: false,
      nb_membres: 2,
    },
  ],
  candidats: [],
  propositions_creees: 0,
  elargissement: { groupes: 7, candidats: 0 },
};

/**
 * Associe un chemin de requête à sa réponse. L'ordre compte : la première
 * entrée dont le motif correspond gagne.
 */
export const REPONSES = [
  [/\/auth\/v1\/user/, () => UTILISATEUR],
  [/\/auth\/v1\/token/, () => ({ ...SESSION })],
  [/\/functions\/v1\/matching/, () => ACTIVATION],
  [/\/rest\/v1\/rpc\/evenements_similaires/, () => []],
  [/\/rest\/v1\/rpc\//, () => []],
  [/\/rest\/v1\/users/, () => [PROFIL]],
  [/\/rest\/v1\/profile_cards/, () => [CARTE]],
  [/\/rest\/v1\/hobbies/, () => HOBBIES],
  [/\/rest\/v1\/card_hobbies/, () => []],
  [/\/rest\/v1\/city_guides/, () => [FICHE_VILLE]],
  [/\/rest\/v1\/v_evenements_ville/, () => EVENEMENTS],
  [/\/rest\/v1\/checklist_items/, () => CHECKLIST],
  [/\/rest\/v1\/user_checklist_status/, () => []],
  [/\/rest\/v1\/v_locaux_actifs/, () => LOCAUX],
  [/\/rest\/v1\/v_mes_conversations/, () => CONVERSATIONS],
  [/\/rest\/v1\/messages/, () => MESSAGES],
  [/\/rest\/v1\/individual_matches/, () => MATCHS],
  [/\/rest\/v1\/v_cartes_publiques/, () => [CARTE_PUBLIQUE]],
  [/\/rest\/v1\/v_profils_publics/, () => [CARTE_PUBLIQUE]],
  [/\/rest\/v1\/blocks/, () => []],
  [/\/rest\/v1\/connections/, () => []],
  [/\/storage\/v1\//, () => ({ signedUrl: null })],
];

/**
 * Applique les paramètres PostgREST de l'URL au tableau renvoyé.
 *
 * Sans ça, les fixtures mentent : une requête triée par date décroissante
 * recevrait les lignes dans l'ordre d'écriture, et l'écran afficherait un ordre
 * que la vraie base ne produirait jamais. Seuls `eq` et `order` sont gérés —
 * assez pour que ce que montrent les captures soit fidèle.
 */
function appliquerRequete(lignes, url) {
  if (!Array.isArray(lignes)) return lignes;
  const parametres = new URL(url).searchParams;
  let resultat = [...lignes];

  for (const [cle, valeur] of parametres) {
    if (cle === "select" || cle === "order" || cle === "limit" || cle === "offset") continue;
    if (valeur.startsWith("eq.")) {
      const attendu = valeur.slice(3);
      resultat = resultat.filter((l) => String(l[cle]) === attendu);
    }
  }

  const tri = parametres.get("order");
  if (tri) {
    const [champ, ...options] = tri.split(".");
    const descendant = options.includes("desc");
    resultat.sort((a, b) => {
      const ga = a[champ] ?? "";
      const gb = b[champ] ?? "";
      if (ga === gb) return 0;
      return (ga < gb ? -1 : 1) * (descendant ? -1 : 1);
    });
  }

  const limite = parametres.get("limit");
  if (limite) resultat = resultat.slice(0, Number(limite));

  return resultat;
}

export function reponsePour(url) {
  for (const [motif, produire] of REPONSES) {
    if (motif.test(url)) return appliquerRequete(produire(), url);
  }
  return null;
}
