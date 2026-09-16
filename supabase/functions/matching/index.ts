/**
 * Edge function `matching` — point d'entrée HTTP du service de matching (§8.1, §8.2).
 *
 * Volontairement mince : authentifier l'appelant, router vers le service,
 * traduire les erreurs métier en codes HTTP. Toute la logique est dans
 * `_partage/`, testée sans réseau ni base.
 *
 * POST avec un corps JSON :
 *   { "action": "activer",        "carte_id": "..." }
 *   { "action": "rejoindre",      "carte_id": "...", "groupe_id": "..." }
 *   { "action": "creer_cohorte",  "carte_id": "..." }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  activerCarte,
  creerSaCohorte,
  ErreurMatching,
  rejoindreGroupe,
  type CodeErreur,
} from "../_partage/service_matching.ts";
import { DepotSupabase } from "./depot_supabase.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUT_PAR_CODE: Record<CodeErreur, number> = {
  carte_introuvable: 404,
  groupe_introuvable: 404,
  carte_ineligible: 409,
  groupe_incompatible: 409,
};

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function erreur(message: string, status: number, code?: string): Response {
  return json({ erreur: message, code }, status);
}

interface Requete {
  action?: string;
  carte_id?: string;
  groupe_id?: string;
}

/** Identifie l'appelant à partir de son JWT, sans lui accorder d'accès élargi. */
async function utilisateurAppelant(req: Request): Promise<string | null> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erreur("Méthode non autorisée", 405);

  const utilisateurId = await utilisateurAppelant(req);
  if (!utilisateurId) return erreur("Authentification requise", 401);

  let corps: Requete;
  try {
    corps = await req.json();
  } catch {
    return erreur("Corps JSON invalide", 400);
  }

  const { action, carte_id: carteId, groupe_id: groupeId } = corps;
  if (!carteId) return erreur("`carte_id` est requis", 400);

  // service_role : voir l'en-tête de depot_supabase.ts pour le cloisonnement.
  const depot = new DepotSupabase(
    createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    ),
    utilisateurId,
  );

  try {
    switch (action) {
      case "activer":
        return json(await activerCarte(depot, carteId));

      case "rejoindre":
        if (!groupeId) return erreur("`groupe_id` est requis pour rejoindre", 400);
        return json({ groupe: await rejoindreGroupe(depot, carteId, groupeId) });

      case "creer_cohorte":
        return json({ groupe: await creerSaCohorte(depot, carteId) }, 201);

      default:
        return erreur(
          "`action` doit valoir activer, rejoindre ou creer_cohorte",
          400,
        );
    }
  } catch (e) {
    if (e instanceof ErreurMatching) {
      return erreur(e.message, STATUT_PAR_CODE[e.code], e.code);
    }
    console.error("Échec du matching", e);
    return erreur("Erreur interne", 500);
  }
});
