// Types générés depuis le schéma Supabase — NE PAS MODIFIER À LA MAIN.
// Régénération : npx supabase gen types typescript --project-id dosfpinsxhyqvmmailnq
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      card_hobbies: {
        Row: { card_id: string; hobby_id: string }
        Insert: { card_id: string; hobby_id: string }
        Update: { card_id?: string; hobby_id?: string }
        Relationships: []
      }
      checklist_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ordre: number
          pays: string
          titre: string
          traductions: Json
          ville: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ordre?: number
          pays: string
          titre: string
          traductions?: Json
          ville?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ordre?: number
          pays?: string
          titre?: string
          traductions?: Json
          ville?: string | null
        }
        Relationships: []
      }
      city_guides: {
        Row: {
          apps_recommandees: Json
          created_at: string
          id: string
          numeros_urgence: Json
          pays: string
          systeme_transport_nom: string | null
          traductions: Json
          transport_description: string | null
          updated_at: string
          ville: string
          ville_place_id: string | null
        }
        Insert: {
          apps_recommandees?: Json
          created_at?: string
          id?: string
          numeros_urgence?: Json
          pays: string
          systeme_transport_nom?: string | null
          traductions?: Json
          transport_description?: string | null
          updated_at?: string
          ville: string
          ville_place_id?: string | null
        }
        Update: {
          apps_recommandees?: Json
          created_at?: string
          id?: string
          numeros_urgence?: Json
          pays?: string
          systeme_transport_nom?: string | null
          traductions?: Json
          transport_description?: string | null
          updated_at?: string
          ville?: string
          ville_place_id?: string | null
        }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          demandeur_user_id: string
          destinataire_user_id: string
          id: string
          message_intro: string | null
          statut: Database["public"]["Enums"]["statut_connexion"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          demandeur_user_id: string
          destinataire_user_id: string
          id?: string
          message_intro?: string | null
          statut?: Database["public"]["Enums"]["statut_connexion"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          demandeur_user_id?: string
          destinataire_user_id?: string
          id?: string
          message_intro?: string | null
          statut?: Database["public"]["Enums"]["statut_connexion"]
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: { conversation_id: string; joined_at: string; user_id: string }
        Insert: { conversation_id: string; joined_at?: string; user_id: string }
        Update: { conversation_id?: string; joined_at?: string; user_id?: string }
        Relationships: []
      }
      conversations: {
        Row: {
          connection_id: string | null
          created_at: string
          id: string
          individual_match_id: string | null
          matching_group_id: string | null
          type: Database["public"]["Enums"]["type_conversation"]
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          id?: string
          individual_match_id?: string | null
          matching_group_id?: string | null
          type: Database["public"]["Enums"]["type_conversation"]
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          id?: string
          individual_match_id?: string | null
          matching_group_id?: string | null
          type?: Database["public"]["Enums"]["type_conversation"]
        }
        Relationships: []
      }
      ephemeral_events: {
        Row: {
          city_guide_id: string
          created_at: string
          date_debut: string
          date_fin: string | null
          description: string | null
          id: string
          lien: string | null
          periode: unknown
          soumis_par_user_id: string | null
          source: Database["public"]["Enums"]["source_evenement"]
          statut_moderation: Database["public"]["Enums"]["statut_moderation"]
          titre: string
          traductions: Json
          type: string
          updated_at: string
        }
        Insert: {
          city_guide_id: string
          created_at?: string
          date_debut: string
          date_fin?: string | null
          description?: string | null
          id?: string
          lien?: string | null
          periode?: unknown
          soumis_par_user_id?: string | null
          source: Database["public"]["Enums"]["source_evenement"]
          statut_moderation?: Database["public"]["Enums"]["statut_moderation"]
          titre: string
          traductions?: Json
          type: string
          updated_at?: string
        }
        Update: {
          city_guide_id?: string
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          description?: string | null
          id?: string
          lien?: string | null
          periode?: unknown
          soumis_par_user_id?: string | null
          source?: Database["public"]["Enums"]["source_evenement"]
          statut_moderation?: Database["public"]["Enums"]["statut_moderation"]
          titre?: string
          traductions?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      hobbies: {
        Row: {
          categorie: string
          icone: string | null
          id: string
          nom: string
          traductions: Json
        }
        Insert: {
          categorie: string
          icone?: string | null
          id?: string
          nom: string
          traductions?: Json
        }
        Update: {
          categorie?: string
          icone?: string | null
          id?: string
          nom?: string
          traductions?: Json
        }
        Relationships: []
      }
      individual_matches: {
        Row: {
          card_id_a: string
          card_id_b: string
          created_at: string
          decision_a: Database["public"]["Enums"]["decision_match"]
          decision_b: Database["public"]["Enums"]["decision_match"]
          id: string
          score: number
          statut: Database["public"]["Enums"]["statut_match"] | null
          updated_at: string
        }
        Insert: {
          card_id_a: string
          card_id_b: string
          created_at?: string
          decision_a?: Database["public"]["Enums"]["decision_match"]
          decision_b?: Database["public"]["Enums"]["decision_match"]
          id?: string
          score?: number
          updated_at?: string
        }
        Update: {
          card_id_a?: string
          card_id_b?: string
          created_at?: string
          decision_a?: Database["public"]["Enums"]["decision_match"]
          decision_b?: Database["public"]["Enums"]["decision_match"]
          id?: string
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      matching_group_members: {
        Row: {
          card_id: string
          group_id: string
          joined_at: string
          statut: Database["public"]["Enums"]["statut_membre_groupe"]
        }
        Insert: {
          card_id: string
          group_id: string
          joined_at?: string
          statut?: Database["public"]["Enums"]["statut_membre_groupe"]
        }
        Update: {
          card_id?: string
          group_id?: string
          joined_at?: string
          statut?: Database["public"]["Enums"]["statut_membre_groupe"]
        }
        Relationships: []
      }
      matching_groups: {
        Row: {
          created_at: string
          cree_par_card_id: string | null
          description: string
          fenetre: unknown
          fenetre_debut: string
          fenetre_fin: string
          id: string
          pays: string
          type_carte: Database["public"]["Enums"]["type_carte"]
          updated_at: string
          ville: string
        }
        Insert: {
          created_at?: string
          cree_par_card_id?: string | null
          description: string
          fenetre_debut: string
          fenetre_fin: string
          id?: string
          pays: string
          type_carte: Database["public"]["Enums"]["type_carte"]
          updated_at?: string
          ville: string
        }
        Update: {
          created_at?: string
          cree_par_card_id?: string | null
          description?: string
          fenetre_debut?: string
          fenetre_fin?: string
          id?: string
          pays?: string
          type_carte?: Database["public"]["Enums"]["type_carte"]
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          contenu: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          contenu: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          contenu?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      points_of_interet: {
        Row: {
          city_guide_id: string
          created_at: string
          description: string | null
          id: string
          lien: string | null
          nom: string
          traductions: Json
          type: string
        }
        Insert: {
          city_guide_id: string
          created_at?: string
          description?: string | null
          id?: string
          lien?: string | null
          nom: string
          traductions?: Json
          type: string
        }
        Update: {
          city_guide_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lien?: string | null
          nom?: string
          traductions?: Json
          type?: string
        }
        Relationships: []
      }
      profile_cards: {
        Row: {
          created_at: string
          date_debut: string | null
          date_fin: string | null
          entreprise: string | null
          entreprise_visible: boolean
          est_principale: boolean
          id: string
          pays: string
          quartier_precis: string | null
          quartier_visible: boolean
          sejour: unknown
          statut: Database["public"]["Enums"]["statut_carte"]
          type: Database["public"]["Enums"]["type_carte"]
          updated_at: string
          user_id: string
          ville: string
          ville_place_id: string | null
        }
        Insert: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          entreprise?: string | null
          entreprise_visible?: boolean
          est_principale?: boolean
          id?: string
          pays: string
          quartier_precis?: string | null
          quartier_visible?: boolean
          statut?: Database["public"]["Enums"]["statut_carte"]
          type: Database["public"]["Enums"]["type_carte"]
          updated_at?: string
          user_id: string
          ville: string
          ville_place_id?: string | null
        }
        Update: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          entreprise?: string | null
          entreprise_visible?: boolean
          est_principale?: boolean
          id?: string
          pays?: string
          quartier_precis?: string | null
          quartier_visible?: boolean
          statut?: Database["public"]["Enums"]["statut_carte"]
          type?: Database["public"]["Enums"]["type_carte"]
          updated_at?: string
          user_id?: string
          ville?: string
          ville_place_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          action_prise: string | null
          conversation_id: string | null
          created_at: string
          description: string | null
          id: string
          message_id: string | null
          motif: Database["public"]["Enums"]["motif_signalement"]
          priorite: Database["public"]["Enums"]["priorite_signalement"]
          reported_user_id: string
          reporter_user_id: string
          statut: Database["public"]["Enums"]["statut_signalement"]
          traite_at: string | null
          traite_par: string | null
        }
        Insert: {
          action_prise?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          message_id?: string | null
          motif: Database["public"]["Enums"]["motif_signalement"]
          priorite?: Database["public"]["Enums"]["priorite_signalement"]
          reported_user_id: string
          reporter_user_id: string
          statut?: Database["public"]["Enums"]["statut_signalement"]
          traite_at?: string | null
          traite_par?: string | null
        }
        Update: {
          action_prise?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          message_id?: string | null
          motif?: Database["public"]["Enums"]["motif_signalement"]
          priorite?: Database["public"]["Enums"]["priorite_signalement"]
          reported_user_id?: string
          reporter_user_id?: string
          statut?: Database["public"]["Enums"]["statut_signalement"]
          traite_at?: string | null
          traite_par?: string | null
        }
        Relationships: []
      }
      user_checklist_status: {
        Row: {
          card_id: string
          checklist_item_id: string
          statut: Database["public"]["Enums"]["statut_checklist"]
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          checklist_item_id: string
          statut?: Database["public"]["Enums"]["statut_checklist"]
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          checklist_item_id?: string
          statut?: Database["public"]["Enums"]["statut_checklist"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          age_max_prefere: number
          age_min_prefere: number
          bio: string | null
          consentement_sensibles_at: string | null
          created_at: string
          date_naissance: string
          email: string
          id: string
          langues: string[]
          nationalites: Json
          nationalites_visible: boolean
          origines: Json
          origines_visible: boolean
          photo_url: string
          religion: string | null
          religion_visible: boolean
          sexe: Database["public"]["Enums"]["type_sexe"]
          sexe_visible: boolean
          updated_at: string
        }
        Insert: {
          age_max_prefere: number
          age_min_prefere: number
          bio?: string | null
          consentement_sensibles_at?: string | null
          created_at?: string
          date_naissance: string
          email: string
          id: string
          langues?: string[]
          nationalites?: Json
          nationalites_visible?: boolean
          origines?: Json
          origines_visible?: boolean
          photo_url: string
          religion?: string | null
          religion_visible?: boolean
          sexe?: Database["public"]["Enums"]["type_sexe"]
          sexe_visible?: boolean
          updated_at?: string
        }
        Update: {
          age_max_prefere?: number
          age_min_prefere?: number
          bio?: string | null
          consentement_sensibles_at?: string | null
          created_at?: string
          date_naissance?: string
          email?: string
          id?: string
          langues?: string[]
          nationalites?: Json
          nationalites_visible?: boolean
          origines?: Json
          origines_visible?: boolean
          photo_url?: string
          religion?: string | null
          religion_visible?: boolean
          sexe?: Database["public"]["Enums"]["type_sexe"]
          sexe_visible?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_cartes_publiques: {
        Row: {
          age: number | null
          bio: string | null
          card_id: string | null
          date_debut: string | null
          date_fin: string | null
          entreprise: string | null
          langues: string[] | null
          pays: string | null
          photo_url: string | null
          quartier_precis: string | null
          sexe: Database["public"]["Enums"]["type_sexe"] | null
          statut: Database["public"]["Enums"]["statut_carte"] | null
          type: Database["public"]["Enums"]["type_carte"] | null
          user_id: string | null
          ville: string | null
        }
        Relationships: []
      }
      v_evenements_ville: {
        Row: {
          city_guide_id: string | null
          date_debut: string | null
          date_fin: string | null
          description: string | null
          id: string | null
          lien: string | null
          pays: string | null
          periode: unknown
          source: Database["public"]["Enums"]["source_evenement"] | null
          titre: string | null
          traductions: Json | null
          type: string | null
          ville: string | null
        }
        Relationships: []
      }
      v_locaux_actifs: {
        Row: {
          age: number | null
          bio: string | null
          card_id: string | null
          hobbies: string[] | null
          langues: string[] | null
          pays: string | null
          photo_url: string | null
          quartier_precis: string | null
          sexe: Database["public"]["Enums"]["type_sexe"] | null
          user_id: string | null
          ville: string | null
        }
        Relationships: []
      }
      v_profils_publics: {
        Row: {
          age: number | null
          bio: string | null
          id: string | null
          langues: string[] | null
          nationalites: Json | null
          origines: Json | null
          photo_url: string | null
          religion: string | null
          sexe: Database["public"]["Enums"]["type_sexe"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      age_utilisateur: { Args: { date_naissance: string }; Returns: number }
      archiver_cartes_expirees: { Args: never; Returns: number }
      candidats_individuels: {
        Args: { carte_id: string; limite?: number; tolerance_jours?: number }
        Returns: {
          card_id: string
          interets_communs: number
          jours_communs: number
          score: number
          user_id: string
        }[]
      }
      evenements_similaires: {
        Args: {
          p_date_debut: string
          p_pays: string
          p_titre: string
          p_ville: string
        }
        Returns: {
          date_debut: string
          date_fin: string
          id: string
          similarite: number
          statut_moderation: Database["public"]["Enums"]["statut_moderation"]
          titre: string
        }[]
      }
      groupes_compatibles: {
        Args: { carte_id: string; tolerance_jours?: number }
        Returns: {
          description: string
          fenetre_debut: string
          fenetre_fin: string
          group_id: string
          meme_type: boolean
          nb_membres: number
        }[]
      }
      jours_chevauchement: { Args: { a: unknown; b: unknown }; Returns: number }
      repondre_match: {
        Args: {
          match_id: string
          reponse: Database["public"]["Enums"]["decision_match"]
        }
        Returns: Database["public"]["Tables"]["individual_matches"]["Row"]
      }
      traduire: {
        Args: {
          champ: string
          langue: string
          traductions: Json
          valeur_par_defaut: string
        }
        Returns: string
      }
    }
    Enums: {
      decision_match: "en_attente" | "accepte" | "refuse"
      motif_signalement:
        | "harcelement"
        | "contenu_inapproprie"
        | "faux_profil"
        | "comportement_deplace"
        | "autre"
      priorite_signalement: "normale" | "haute"
      source_evenement: "agrege" | "utilisateur"
      statut_carte: "actif" | "inactif" | "archive"
      statut_checklist: "a_faire" | "en_cours" | "fait"
      statut_connexion: "en_attente" | "accepte" | "refuse"
      statut_match: "propose" | "accepte" | "refuse"
      statut_membre_groupe: "membre" | "en_attente"
      statut_moderation: "en_attente" | "approuve" | "rejete"
      statut_signalement: "en_attente" | "en_cours" | "traite"
      type_carte: "local" | "voyageur" | "travailleur"
      type_conversation: "direct" | "groupe"
      type_sexe: "femme" | "homme" | "autre" | "non_precise"
    }
    CompositeTypes: Record<never, never>
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R }
  ? R
  : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

export type ResultatFonction<T extends keyof DefaultSchema["Functions"]> =
  DefaultSchema["Functions"][T]["Returns"]
