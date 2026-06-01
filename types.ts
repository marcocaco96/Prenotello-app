export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appuntamenti: {
        Row: {
          allergie: string | null
          cliente_id: string | null
          created_at: string
          durata_minuti: number
          id: string
          importo: number | null
          metodo_pagamento: string | null
          nome_cliente: string
          note: string | null
          servizio: string
          staff_id: string | null
          start_at: string
          stato: string
          stato_pagamento: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergie?: string | null
          cliente_id?: string | null
          created_at?: string
          durata_minuti?: number
          id?: string
          importo?: number | null
          metodo_pagamento?: string | null
          nome_cliente: string
          note?: string | null
          servizio: string
          staff_id?: string | null
          start_at: string
          stato?: string
          stato_pagamento?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergie?: string | null
          cliente_id?: string | null
          created_at?: string
          durata_minuti?: number
          id?: string
          importo?: number | null
          metodo_pagamento?: string | null
          nome_cliente?: string
          note?: string | null
          servizio?: string
          staff_id?: string | null
          start_at?: string
          stato?: string
          stato_pagamento?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appuntamenti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appuntamenti_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          allergie: string | null
          codice_sdi: string | null
          cognome: string
          come_conosciuto: string | null
          created_at: string
          data_nascita: string | null
          email: string | null
          id: string
          indirizzo_fatturazione: string | null
          nome: string
          note: string | null
          partita_iva: string | null
          pec: string | null
          ragione_sociale: string | null
          sesso: string | null
          telefono: string | null
          tipo_cliente: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allergie?: string | null
          codice_sdi?: string | null
          cognome: string
          come_conosciuto?: string | null
          created_at?: string
          data_nascita?: string | null
          email?: string | null
          id?: string
          indirizzo_fatturazione?: string | null
          nome: string
          note?: string | null
          partita_iva?: string | null
          pec?: string | null
          ragione_sociale?: string | null
          sesso?: string | null
          telefono?: string | null
          tipo_cliente?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allergie?: string | null
          codice_sdi?: string | null
          cognome?: string
          come_conosciuto?: string | null
          created_at?: string
          data_nascita?: string | null
          email?: string | null
          id?: string
          indirizzo_fatturazione?: string | null
          nome?: string
          note?: string | null
          partita_iva?: string | null
          pec?: string | null
          ragione_sociale?: string | null
          sesso?: string | null
          telefono?: string | null
          tipo_cliente?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consensi_firmati: {
        Row: {
          appuntamento_id: string | null
          cliente_id: string | null
          cognome_firma: string | null
          created_at: string
          firma_data_url: string | null
          firmato_at: string | null
          id: string
          modulo_id: string | null
          nome_firma: string | null
          nome_modulo: string
          pdf_path: string | null
          stato: string
          testo_snapshot: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appuntamento_id?: string | null
          cliente_id?: string | null
          cognome_firma?: string | null
          created_at?: string
          firma_data_url?: string | null
          firmato_at?: string | null
          id?: string
          modulo_id?: string | null
          nome_firma?: string | null
          nome_modulo: string
          pdf_path?: string | null
          stato?: string
          testo_snapshot: string
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appuntamento_id?: string | null
          cliente_id?: string | null
          cognome_firma?: string | null
          created_at?: string
          firma_data_url?: string | null
          firmato_at?: string | null
          id?: string
          modulo_id?: string | null
          nome_firma?: string | null
          nome_modulo?: string
          pdf_path?: string | null
          stato?: string
          testo_snapshot?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consensi_firmati_appuntamento_id_fkey"
            columns: ["appuntamento_id"]
            isOneToOne: false
            referencedRelation: "appuntamenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consensi_firmati_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consensi_firmati_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "moduli_consenso"
            referencedColumns: ["id"]
          },
        ]
      }
      moduli_consenso: {
        Row: {
          attivo: boolean
          created_at: string
          id: string
          nome: string
          testo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome: string
          testo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome?: string
          testo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prodotti: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          marca: string | null
          nome: string
          prezzo_acquisto: number | null
          prezzo_vendita: number | null
          quantita: number
          quantita_minima: number
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          marca?: string | null
          nome: string
          prezzo_acquisto?: number | null
          prezzo_vendita?: number | null
          quantita?: number
          quantita_minima?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          marca?: string | null
          nome?: string
          prezzo_acquisto?: number | null
          prezzo_vendita?: number | null
          quantita?: number
          quantita_minima?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salone_aperture_straordinarie: {
        Row: {
          created_at: string
          data: string
          id: string
          note: string | null
          ora_fine: string
          ora_inizio: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          note?: string | null
          ora_fine: string
          ora_inizio: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          note?: string | null
          ora_fine?: string
          ora_inizio?: string
          user_id?: string
        }
        Relationships: []
      }
      salone_chiusure_straordinarie: {
        Row: {
          created_at: string
          data_fine: string
          data_inizio: string
          id: string
          motivo: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fine: string
          data_inizio: string
          id?: string
          motivo?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data_fine?: string
          data_inizio?: string
          id?: string
          motivo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      salone_orari: {
        Row: {
          chiuso: boolean
          created_at: string
          giorno_settimana: number
          id: string
          ora_fine: string
          ora_inizio: string
          pausa_fine: string | null
          pausa_inizio: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chiuso?: boolean
          created_at?: string
          giorno_settimana: number
          id?: string
          ora_fine?: string
          ora_inizio?: string
          pausa_fine?: string | null
          pausa_inizio?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chiuso?: boolean
          created_at?: string
          giorno_settimana?: number
          id?: string
          ora_fine?: string
          ora_inizio?: string
          pausa_fine?: string | null
          pausa_inizio?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saloni: {
        Row: {
          created_at: string
          id: string
          modalita_pagamento_online: string
          nome: string
          pagamento_online_obbligatorio: boolean
          prenotazioni_online_attive: boolean
          satispay_attivo: boolean
          satispay_key_id: string | null
          satispay_private_key: string | null
          slug: string
          stripe_attivo: boolean
          stripe_publishable_key: string | null
          stripe_secret_key: string | null
          stripe_webhook_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modalita_pagamento_online?: string
          nome?: string
          pagamento_online_obbligatorio?: boolean
          prenotazioni_online_attive?: boolean
          satispay_attivo?: boolean
          satispay_key_id?: string | null
          satispay_private_key?: string | null
          slug: string
          stripe_attivo?: boolean
          stripe_publishable_key?: string | null
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modalita_pagamento_online?: string
          nome?: string
          pagamento_online_obbligatorio?: boolean
          prenotazioni_online_attive?: boolean
          satispay_attivo?: boolean
          satispay_key_id?: string | null
          satispay_private_key?: string | null
          slug?: string
          stripe_attivo?: boolean
          stripe_publishable_key?: string | null
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      servizi: {
        Row: {
          attivo: boolean
          created_at: string
          durata_minuti: number
          id: string
          nome: string
          prezzo: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          durata_minuti?: number
          id?: string
          nome: string
          prezzo?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          durata_minuti?: number
          id?: string
          nome?: string
          prezzo?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          attivo: boolean
          cognome: string
          colore: string
          created_at: string
          foto_url: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attivo?: boolean
          cognome: string
          colore?: string
          created_at?: string
          foto_url?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attivo?: boolean
          cognome?: string
          colore?: string
          created_at?: string
          foto_url?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_assenze: {
        Row: {
          created_at: string
          data_fine: string
          data_inizio: string
          id: string
          motivo: string | null
          staff_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fine: string
          data_inizio: string
          id?: string
          motivo?: string | null
          staff_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_fine?: string
          data_inizio?: string
          id?: string
          motivo?: string | null
          staff_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assenze_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_orari: {
        Row: {
          created_at: string
          giorno_settimana: number
          id: string
          ora_fine: string
          ora_inizio: string
          pausa_fine: string | null
          pausa_inizio: string | null
          staff_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          giorno_settimana: number
          id?: string
          ora_fine: string
          ora_inizio: string
          pausa_fine?: string | null
          pausa_inizio?: string | null
          staff_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          giorno_settimana?: number
          id?: string
          ora_fine?: string
          ora_inizio?: string
          pausa_fine?: string | null
          pausa_inizio?: string | null
          staff_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_orari_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_servizi: {
        Row: {
          created_at: string
          id: string
          servizio_id: string
          staff_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          servizio_id: string
          staff_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          servizio_id?: string
          staff_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_servizi_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_servizi_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      vendite_prodotti: {
        Row: {
          appuntamento_id: string | null
          created_at: string
          id: string
          nome_prodotto: string
          prezzo_unitario: number
          prodotto_id: string | null
          quantita: number
          user_id: string
        }
        Insert: {
          appuntamento_id?: string | null
          created_at?: string
          id?: string
          nome_prodotto: string
          prezzo_unitario?: number
          prodotto_id?: string | null
          quantita?: number
          user_id: string
        }
        Update: {
          appuntamento_id?: string | null
          created_at?: string
          id?: string
          nome_prodotto?: string
          prezzo_unitario?: number
          prodotto_id?: string | null
          quantita?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendite_prodotti_appuntamento_id_fkey"
            columns: ["appuntamento_id"]
            isOneToOne: false
            referencedRelation: "appuntamenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendite_prodotti_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
