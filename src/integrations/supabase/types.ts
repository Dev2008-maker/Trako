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
      bus_locations: {
        Row: {
          accuracy: number | null
          bus_id: string
          heading: number | null
          id: string
          is_demo: boolean
          lat: number
          lon: number
          recorded_at: string
          session_id: string
          speed: number | null
          trip_id: string | null
        }
        Insert: {
          accuracy?: number | null
          bus_id: string
          heading?: number | null
          id?: string
          is_demo?: boolean
          lat: number
          lon: number
          recorded_at?: string
          session_id: string
          speed?: number | null
          trip_id?: string | null
        }
        Update: {
          accuracy?: number | null
          bus_id?: string
          heading?: number | null
          id?: string
          is_demo?: boolean
          lat?: number
          lon?: number
          recorded_at?: string
          session_id?: string
          speed?: number | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_locations_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_locations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          bus_no: string
          created_at: string
          id: string
          route_id: string | null
        }
        Insert: {
          bus_no: string
          created_at?: string
          id?: string
          route_id?: string | null
        }
        Update: {
          bus_no?: string
          created_at?: string
          id?: string
          route_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buses_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      route_shapes: {
        Row: {
          coordinates: Json
          direction: number
          id: string
          route_id: string
        }
        Insert: {
          coordinates: Json
          direction?: number
          id?: string
          route_id: string
        }
        Update: {
          coordinates?: Json
          direction?: number
          id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_shapes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          direction: number
          id: string
          route_id: string
          seq: number
          stop_id: string
        }
        Insert: {
          direction?: number
          id?: string
          route_id: string
          seq: number
          stop_id: string
        }
        Update: {
          direction?: number
          id?: string
          route_id?: string
          seq?: number
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          destination: string
          id: string
          name: string
          origin: string
          route_no: string
        }
        Insert: {
          created_at?: string
          destination: string
          id?: string
          name: string
          origin: string
          route_no: string
        }
        Update: {
          created_at?: string
          destination?: string
          id?: string
          name?: string
          origin?: string
          route_no?: string
        }
        Relationships: []
      }
      saved_stops: {
        Row: {
          alarm_enabled: boolean
          created_at: string
          id: string
          stop_id: string
          user_id: string
        }
        Insert: {
          alarm_enabled?: boolean
          created_at?: string
          id?: string
          stop_id: string
          user_id: string
        }
        Update: {
          alarm_enabled?: boolean
          created_at?: string
          id?: string
          stop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_times: {
        Row: {
          arrival_time: string
          id: string
          seq: number
          stop_id: string
          trip_id: string
        }
        Insert: {
          arrival_time: string
          id?: string
          seq: number
          stop_id: string
          trip_id: string
        }
        Update: {
          arrival_time?: string
          id?: string
          seq?: number
          stop_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_times_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_times_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          area: string | null
          code: string | null
          created_at: string
          id: string
          lat: number
          lon: number
          name: string
        }
        Insert: {
          area?: string | null
          code?: string | null
          created_at?: string
          id?: string
          lat: number
          lon: number
          name: string
        }
        Update: {
          area?: string | null
          code?: string | null
          created_at?: string
          id?: string
          lat?: number
          lon?: number
          name?: string
        }
        Relationships: []
      }
      tracking_sessions: {
        Row: {
          alarm_enabled: boolean
          bus_id: string
          destination_stop_id: string | null
          ended_at: string | null
          id: string
          is_demo: boolean
          last_ping_at: string | null
          started_at: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          alarm_enabled?: boolean
          bus_id: string
          destination_stop_id?: string | null
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          last_ping_at?: string | null
          started_at?: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          alarm_enabled?: boolean
          bus_id?: string
          destination_stop_id?: string | null
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          last_ping_at?: string | null
          started_at?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_sessions_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_sessions_destination_stop_id_fkey"
            columns: ["destination_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_sessions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          bus_id: string | null
          created_at: string
          departure_time: string
          direction: number
          id: string
          is_demo: boolean
          route_id: string
          status: string
        }
        Insert: {
          bus_id?: string | null
          created_at?: string
          departure_time: string
          direction?: number
          id?: string
          is_demo?: boolean
          route_id: string
          status?: string
        }
        Update: {
          bus_id?: string | null
          created_at?: string
          departure_time?: string
          direction?: number
          id?: string
          is_demo?: boolean
          route_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      tracking_count: { Args: { _bus_id: string }; Returns: number }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
