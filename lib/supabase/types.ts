export type Level = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export type Profile = {
  id: string;
  display_name: string | null;
  tz: string;
  digest_email: boolean;
  created_at: string;
};

export type Child = {
  id: string;
  parent_id: string;
  name: string;
  level: Level;
  emoji: string;
  xp: number;
  cheer: string | null;
  last_summary: string | null;
  hard_mode: boolean;
  streak: number;
  streak_grace_used: boolean;
  last_set_done: string | null;
  chars_written_week: number;
  chars_week_start: string | null;
  last_active: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      children: {
        Row: Child;
        Insert: Partial<Child> & {
          parent_id: string;
          name: string;
          level: Level;
        };
        Update: Partial<Child>;
        Relationships: [];
      };
      events: {
        Row: { id: number; user_id: string | null; event: string; ts: string };
        Insert: { user_id: string; event: string };
        Update: { user_id?: string; event?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
