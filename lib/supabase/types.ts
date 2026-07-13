export type Level = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
export type SectionKind = "words" | "pinyin" | "passage";
export type ListStatus = "active" | "tested" | "archived";
export type ListSource = "ocr" | "manual" | "share";

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

export type List = {
  id: string;
  child_id: string;
  name: string;
  test_date: string | null;
  status: ListStatus;
  best_pct: number | null;
  bloomed: boolean;
  predicted_at_test: number | null;
  actual_score: number | null;
  actual_total: number | null;
  source: ListSource;
  created_at: string;
};

export type Section = {
  id: string;
  list_id: string;
  kind: SectionKind;
  title: string | null;
  pick_n: number | null;
  ord: number;
};

export type Item = {
  id: string;
  section_id: string;
  ord: number;
  hanzi: string;
  pinyin: string | null;
  english: string | null;
  ocr_confidence: number | null;
};

export type Mastery = {
  child_id: string;
  item_id: string;
  level: number;
  misses: number;
  char_misses: Record<string, number>;
  pinned: boolean;
  prev_fail: boolean;
  improved: boolean;
  last_trace_svg: string | null;
  last_seen: string | null;
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
      lists: {
        Row: List;
        Insert: Partial<List> & { child_id: string; name: string };
        Update: Partial<List>;
        Relationships: [];
      };
      sections: {
        Row: Section;
        Insert: Partial<Section> & { list_id: string; kind: SectionKind };
        Update: Partial<Section>;
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: Partial<Item> & { section_id: string; ord: number; hanzi: string };
        Update: Partial<Item>;
        Relationships: [];
      };
      mastery: {
        Row: Mastery;
        Insert: Partial<Mastery> & { child_id: string; item_id: string };
        Update: Partial<Mastery>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_list_tx: {
        Args: {
          child_id: string;
          name: string;
          test_date: string | null;
          source: string | null;
          sections_json: ManualSectionInput[];
        };
        Returns: string;
      };
      record_item_progress: {
        Args: {
          child_id: string;
          item_id: string;
          chars_written: number;
          trace_svg?: string | null;
        };
        Returns: number;
      };
      record_set_complete: {
        Args: {
          child_id: string;
          list_id: string;
          items_count: number;
        };
        Returns: undefined;
      };
    };
  };
};

export type ManualSectionInput = {
  kind: SectionKind;
  title?: string;
  pick_n?: number;
  ord?: number;
  items: {
    ord: number;
    hanzi: string;
    pinyin?: string;
    english?: string;
  }[];
};
