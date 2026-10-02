export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      bus_locations: {
        Row: {
          accuracy: number | null;
          bus_id: string;
          heading: number | null;
          id: string;
          is_demo: boolean;
          lat: number;
          lon: number;
          recorded_at: string;
          session_id: string;
          speed: number | null;
          trip_id: string | null;
        };
        Insert: {
          accuracy?: number | null;
          bus_id: string;
          heading?: number | null;
          id?: string;
          is_demo?: boolean;
          lat: number;
          lon: number;
          recorded_at?: string;
          session_id: string;
          speed?: number | null;
          trip_id?: string | null;
        };
        Update: {
          accuracy?: number | null;
          bus_id?: string;
          heading?: number | null;
          id?: string;
          is_demo?: boolean;
          lat?: number;
          lon?: number;
          recorded_at?: string;
          session_id?: string;
          speed?: number | null;
          trip_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bus_locations_bus_id_fkey";
            columns: ["bus_id"];
            isOneToOne: false;
            referencedRelation: "buses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bus_locations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "tracking_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bus_locations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      buses: {
        Row: {
          bus_no: string;
          created_at: string;
          id: string;
          route_id: string | null;
        };
        Insert: {
          bus_no: string;
          created_at?: string;
          id?: string;
          route_id?: string | null;
        };
        Update: {
          bus_no?: string;
          created_at?: string;
          id?: string;
          route_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "buses_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      route_shapes: {
        Row: {
          coordinates: Json;
          direction: number;
          id: string;
          route_id: string;
        };
        Insert: {
          coordinates: Json;
          direction?: number;
          id?: string;
          route_id: string;
        };
        Update: {
          coordinates?: Json;
          direction?: number;
          id?: string;
          route_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "route_shapes_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
        ];
      };
      route_stops: {
        Row: {
          direction: number;
          id: string;
          route_id: string;
          seq: number;
          stop_id: string;
        };
        Insert: {
          direction?: number;
          id?: string;
          route_id: string;
          seq: number;
          stop_id: string;
        };
        Update: {
          direction?: number;
          id?: string;
          route_id?: string;
          seq?: number;
          stop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "route_stops_stop_id_fkey";
            columns: ["stop_id"];
            isOneToOne: false;
            referencedRelation: "stops";
            referencedColumns: ["id"];
          },
        ];
      };
      routes: {
        Row: {
          created_at?: string;
          destination?: string;
          id?: string;
          name?: string;
          origin?: string;
          route_no?: string;
          route_id: string;
          agency_id: string | null;
          route_short_name: string;
          route_long_name: string;
          route_type: number;
        };
        Insert: {
          created_at?: string;
          destination?: string;
          id?: string;
          name?: string;
          origin?: string;
          route_no?: string;
          route_id: string;
          agency_id?: string | null;
          route_short_name: string;
          route_long_name: string;
          route_type?: number;
        };
        Update: {
          created_at?: string;
          destination?: string;
          id?: string;
          name?: string;
          origin?: string;
          route_no?: string;
          route_id?: string;
          agency_id?: string | null;
          route_short_name?: string;
          route_long_name?: string;
          route_type?: number;
        };
        Relationships: [];
      };
      saved_stops: {
        Row: {
          alarm_enabled: boolean;
          created_at: string;
          id: string;
          stop_id: string;
          user_id: string;
        };
        Insert: {
          alarm_enabled?: boolean;
          created_at?: string;
          id?: string;
          stop_id: string;
          user_id: string;
        };
        Update: {
          alarm_enabled?: boolean;
          created_at?: string;
          id?: string;
          stop_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_stops_stop_id_fkey";
            columns: ["stop_id"];
            isOneToOne: false;
            referencedRelation: "stops";
            referencedColumns: ["id"];
          },
        ];
      };
      stop_times: {
        Row: {
          arrival_time: string;
          departure_time?: string;
          id?: string;
          seq?: number;
          stop_sequence?: number;
          stop_id: string;
          trip_id: string;
        };
        Insert: {
          arrival_time: string;
          departure_time?: string;
          id?: string;
          seq?: number;
          stop_sequence?: number;
          stop_id: string;
          trip_id: string;
        };
        Update: {
          arrival_time?: string;
          departure_time?: string;
          id?: string;
          seq?: number;
          stop_sequence?: number;
          stop_id?: string;
          trip_id?: string;
        };
        Relationships: [];
      };
      stops: {
        Row: {
          area?: string | null;
          code?: string | null;
          created_at?: string;
          id?: string;
          lat?: number;
          lon?: number;
          name?: string;
          stop_id: string;
          stop_name: string;
          stop_lat: number;
          stop_lon: number;
        };
        Insert: {
          area?: string | null;
          code?: string | null;
          created_at?: string;
          id?: string;
          lat?: number;
          lon?: number;
          name?: string;
          stop_id: string;
          stop_name: string;
          stop_lat: number;
          stop_lon: number;
        };
        Update: {
          area?: string | null;
          code?: string | null;
          created_at?: string;
          id?: string;
          lat?: number;
          lon?: number;
          name?: string;
          stop_id?: string;
          stop_name?: string;
          stop_lat?: number;
          stop_lon?: number;
        };
        Relationships: [];
      };
      tracking_sessions: {
        Row: {
          alarm_enabled: boolean;
          bus_id: string;
          destination_stop_id: string | null;
          ended_at: string | null;
          id: string;
          is_demo: boolean;
          last_ping_at: string | null;
          started_at: string;
          trip_id: string | null;
          user_id: string;
        };
        Insert: {
          alarm_enabled?: boolean;
          bus_id: string;
          destination_stop_id?: string | null;
          ended_at?: string | null;
          id?: string;
          is_demo?: boolean;
          last_ping_at?: string | null;
          started_at?: string;
          trip_id?: string | null;
          user_id: string;
        };
        Update: {
          alarm_enabled?: boolean;
          bus_id?: string;
          destination_stop_id?: string | null;
          ended_at?: string | null;
          id?: string;
          is_demo?: boolean;
          last_ping_at?: string | null;
          started_at?: string;
          trip_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          bus_id?: string | null;
          created_at?: string;
          departure_time?: string;
          direction?: number;
          id?: string;
          is_demo?: boolean;
          route_id: string;
          status?: string;
          trip_id: string;
          service_id: string;
          trip_headsign: string | null;
          direction_id?: number;
          shape_id?: string | null;
        };
        Insert: {
          bus_id?: string | null;
          created_at?: string;
          departure_time?: string;
          direction?: number;
          id?: string;
          is_demo?: boolean;
          route_id: string;
          status?: string;
          trip_id: string;
          service_id: string;
          trip_headsign?: string | null;
          direction_id?: number;
          shape_id?: string | null;
        };
        Update: {
          bus_id?: string | null;
          created_at?: string;
          departure_time?: string;
          direction?: number;
          id?: string;
          is_demo?: boolean;
          route_id?: string;
          status?: string;
          trip_id?: string;
          service_id?: string;
          trip_headsign?: string | null;
          direction_id?: number;
          shape_id?: string | null;
        };
        Relationships: [];
      };
      shapes: {
        Row: {
          shape_id: string;
          shape_pt_lat: number;
          shape_pt_lon: number;
          shape_pt_sequence: number;
        };
        Insert: {
          shape_id: string;
          shape_pt_lat: number;
          shape_pt_lon: number;
          shape_pt_sequence: number;
        };
        Update: {
          shape_id?: string;
          shape_pt_lat?: number;
          shape_pt_lon?: number;
          shape_pt_sequence?: number;
        };
        Relationships: [];
      };
      calendar: {
        Row: {
          service_id: string;
          monday: number;
          tuesday: number;
          wednesday: number;
          thursday: number;
          friday: number;
          saturday: number;
          sunday: number;
          start_date: string;
          end_date: string;
        };
        Insert: {
          service_id: string;
          monday: number;
          tuesday: number;
          wednesday: number;
          thursday: number;
          friday: number;
          saturday: number;
          sunday: number;
          start_date: string;
          end_date: string;
        };
        Update: {
          service_id?: string;
          monday?: number;
          tuesday?: number;
          wednesday?: number;
          thursday?: number;
          friday?: number;
          saturday?: number;
          sunday?: number;
          start_date?: string;
          end_date?: string;
        };
        Relationships: [];
      };
      calendar_dates: {
        Row: {
          service_id: string;
          date: string;
          exception_type: number;
        };
        Insert: {
          service_id: string;
          date: string;
          exception_type: number;
        };
        Update: {
          service_id?: string;
          date?: string;
          exception_type?: number;
        };
        Relationships: [];
      };
      journey_groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          created_at: string;
          expires_at: string | null;
          status: "active" | "ended";
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
          expires_at?: string | null;
          status?: "active" | "ended";
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
          expires_at?: string | null;
          status?: "active" | "ended";
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
          status: "active" | "removed" | "left";
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role?: "owner" | "member";
          joined_at?: string;
          status?: "active" | "removed" | "left";
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          role?: "owner" | "member";
          joined_at?: string;
          status?: "active" | "removed" | "left";
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "journey_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_invites: {
        Row: {
          id: string;
          group_id: string;
          token_hash: string;
          created_by: string;
          created_at: string;
          expires_at: string | null;
          max_uses: number | null;
          uses: number;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          token_hash: string;
          created_by: string;
          created_at?: string;
          expires_at?: string | null;
          max_uses?: number | null;
          uses?: number;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          group_id?: string;
          token_hash?: string;
          created_by?: string;
          created_at?: string;
          expires_at?: string | null;
          max_uses?: number | null;
          uses?: number;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "journey_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      location_shares: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          started_at: string;
          expires_at: string | null;
          stopped_at: string | null;
          sharing_status: "active" | "paused" | "stopped" | "expired";
          transit_mode: string | null;
          transit_label: string | null;
          current_stop: string | null;
          next_stop: string | null;
          eta_minutes: number | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          started_at?: string;
          expires_at?: string | null;
          stopped_at?: string | null;
          sharing_status?: "active" | "paused" | "stopped" | "expired";
          transit_mode?: string | null;
          transit_label?: string | null;
          current_stop?: string | null;
          next_stop?: string | null;
          eta_minutes?: number | null;
        };
        Update: {
          id?: string;
          group_id?: string;
          user_id?: string;
          started_at?: string;
          expires_at?: string | null;
          stopped_at?: string | null;
          sharing_status?: "active" | "paused" | "stopped" | "expired";
          transit_mode?: string | null;
          transit_label?: string | null;
          current_stop?: string | null;
          next_stop?: string | null;
          eta_minutes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "location_shares_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "journey_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      location_updates: {
        Row: {
          id: string;
          share_id: string;
          group_id: string;
          user_id: string;
          lat: number;
          lon: number;
          accuracy_m: number | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          share_id: string;
          group_id: string;
          user_id: string;
          lat: number;
          lon: number;
          accuracy_m?: number | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          share_id?: string;
          group_id?: string;
          user_id?: string;
          lat?: number;
          lon?: number;
          accuracy_m?: number | null;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "location_updates_share_id_fkey";
            columns: ["share_id"];
            isOneToOne: false;
            referencedRelation: "location_shares";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      join_group_with_token: {
        Args: { _raw_token: string };
        Returns: Json;
      };
      expire_stale_shares: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
