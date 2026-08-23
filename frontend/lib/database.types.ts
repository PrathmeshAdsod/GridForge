// Supabase Database type definitions — matches schema in migrations/001_initial.sql
// Format follows @supabase/supabase-js expected generic structure

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      demo_store_state: {
        Row: {
          id: number
          layout_version: string
          panel_440w_in_stock: boolean
          panel_550w_in_stock: boolean
          panel_375w_in_stock: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          layout_version?: string
          panel_440w_in_stock?: boolean
          panel_550w_in_stock?: boolean
          panel_375w_in_stock?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          layout_version?: string
          panel_440w_in_stock?: boolean
          panel_550w_in_stock?: boolean
          panel_375w_in_stock?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          id: string
          name: string
          url: string
          collector_id: string | null
          source_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          collector_id?: string | null
          source_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          collector_id?: string | null
          source_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      scrape_runs: {
        Row: {
          id: string
          source_id: string
          collector_id: string
          bright_data_run_id: string | null
          status: string
          products_total: number | null
          products_verified: number | null
          field_coverage: Json | null
          schema_failure_rate: number | null
          started_at: string
          completed_at: string | null
          error_detail: string | null
        }
        Insert: {
          id?: string
          source_id: string
          collector_id: string
          bright_data_run_id?: string | null
          status?: string
          products_total?: number | null
          products_verified?: number | null
          field_coverage?: Json | null
          schema_failure_rate?: number | null
          started_at?: string
          completed_at?: string | null
          error_detail?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          collector_id?: string
          bright_data_run_id?: string | null
          status?: string
          products_total?: number | null
          products_verified?: number | null
          field_coverage?: Json | null
          schema_failure_rate?: number | null
          started_at?: string
          completed_at?: string | null
          error_detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scrape_runs_source_id_fkey"
            columns: ["source_id"]
            referencedRelation: "sources"
            referencedColumns: ["id"]
          }
        ]
      }
      source_health_events: {
        Row: {
          id: string
          source_id: string
          collector_id: string
          event_type: string
          health_state: string
          detail: string | null
          metadata: Json | null
          scrape_run_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          source_id: string
          collector_id: string
          event_type: string
          health_state: string
          detail?: string | null
          metadata?: Json | null
          scrape_run_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          source_id?: string
          collector_id?: string
          event_type?: string
          health_state?: string
          detail?: string | null
          metadata?: Json | null
          scrape_run_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_health_events_source_id_fkey"
            columns: ["source_id"]
            referencedRelation: "sources"
            referencedColumns: ["id"]
          }
        ]
      }
      components: {
        Row: {
          id: string
          source_id: string
          scrape_run_id: string | null
          external_product_id: string | null
          component_type: string
          manufacturer: string | null
          model: string | null
          pmax_w: number | null
          voc_v: number | null
          vmp_v: number | null
          isc_a: number | null
          imp_a: number | null
          voc_temp_coeff_pct_per_c: number | null
          efficiency_pct: number | null
          cell_type: string | null
          ac_output_w: number | null
          battery_voltage_v: number | null
          max_pv_voltage_v: number | null
          mppt_min_v: number | null
          mppt_max_v: number | null
          max_pv_current_a: number | null
          max_pv_power_w: number | null
          nominal_voltage_v: number | null
          capacity_ah: number | null
          capacity_kwh: number | null
          dod_pct: number | null
          chemistry: string | null
          cycle_life: number | null
          price_inr: number | null
          availability: string | null
          original_url: string | null
          verification_status: string
          scraped_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          source_id: string
          scrape_run_id?: string | null
          external_product_id?: string | null
          component_type: string
          manufacturer?: string | null
          model?: string | null
          pmax_w?: number | null
          voc_v?: number | null
          vmp_v?: number | null
          isc_a?: number | null
          imp_a?: number | null
          voc_temp_coeff_pct_per_c?: number | null
          efficiency_pct?: number | null
          cell_type?: string | null
          ac_output_w?: number | null
          battery_voltage_v?: number | null
          max_pv_voltage_v?: number | null
          mppt_min_v?: number | null
          mppt_max_v?: number | null
          max_pv_current_a?: number | null
          max_pv_power_w?: number | null
          nominal_voltage_v?: number | null
          capacity_ah?: number | null
          capacity_kwh?: number | null
          dod_pct?: number | null
          chemistry?: string | null
          cycle_life?: number | null
          price_inr?: number | null
          availability?: string | null
          original_url?: string | null
          verification_status?: string
          scraped_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          source_id?: string
          scrape_run_id?: string | null
          external_product_id?: string | null
          component_type?: string
          manufacturer?: string | null
          model?: string | null
          pmax_w?: number | null
          voc_v?: number | null
          vmp_v?: number | null
          isc_a?: number | null
          imp_a?: number | null
          voc_temp_coeff_pct_per_c?: number | null
          efficiency_pct?: number | null
          cell_type?: string | null
          ac_output_w?: number | null
          battery_voltage_v?: number | null
          max_pv_voltage_v?: number | null
          mppt_min_v?: number | null
          mppt_max_v?: number | null
          max_pv_current_a?: number | null
          max_pv_power_w?: number | null
          nominal_voltage_v?: number | null
          capacity_ah?: number | null
          capacity_kwh?: number | null
          dod_pct?: number | null
          chemistry?: string | null
          cycle_life?: number | null
          price_inr?: number | null
          availability?: string | null
          original_url?: string | null
          verification_status?: string
          scraped_at?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "components_source_id_fkey"
            columns: ["source_id"]
            referencedRelation: "sources"
            referencedColumns: ["id"]
          }
        ]
      }
      compilation_runs: {
        Row: {
          id: string
          user_id: string | null
          requirement_nl: string | null
          requirement_structured: Json | null
          data_source: string
          status: string
          topology_result: Json | null
          metrics: Json | null
          candidates_evaluated: number | null
          candidates_rejected: number | null
          candidates_validated: number | null
          collector_ids: string[] | null
          scrape_run_ids: string[] | null
          error_detail: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          requirement_nl?: string | null
          requirement_structured?: Json | null
          data_source: string
          status?: string
          topology_result?: Json | null
          metrics?: Json | null
          candidates_evaluated?: number | null
          candidates_rejected?: number | null
          candidates_validated?: number | null
          collector_ids?: string[] | null
          scrape_run_ids?: string[] | null
          error_detail?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          requirement_nl?: string | null
          requirement_structured?: Json | null
          data_source?: string
          status?: string
          topology_result?: Json | null
          metrics?: Json | null
          candidates_evaluated?: number | null
          candidates_rejected?: number | null
          candidates_validated?: number | null
          collector_ids?: string[] | null
          scrape_run_ids?: string[] | null
          error_detail?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          requirement_nl: string | null
          requirement_structured: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          requirement_nl?: string | null
          requirement_structured?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          requirement_nl?: string | null
          requirement_structured?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          id: string
          project_id: string
          user_id: string
          compilation_run_id: string | null
          version: number
          is_current: boolean
          topology: Json
          metrics: Json | null
          change_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          compilation_run_id?: string | null
          version?: number
          is_current?: boolean
          topology: Json
          metrics?: Json | null
          change_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          compilation_run_id?: string | null
          version?: number
          is_current?: boolean
          topology?: Json
          metrics?: Json | null
          change_reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designs_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
