// Shared types for the multi-tab damage calculator (components/damage/*).
// DESIGN STATE: scaffold only — the damage formula and full preset data are
// intentionally deferred. See config.ts for the (currently stubbed) data.

/** Numeric stats that aggregate across every source tab. */
export type StatKey =
  | "atkFlat" // 攻擊力 (flat)
  | "atkPct" // 攻擊力 % (percentage)
  | "critRate" // 暴擊率 %
  | "critDmg" // 暴擊傷害 (flat — added to ATK on crit per 傷害篇)
  | "bDmg" // 傷害增加 / B傷 %
  | "penetration"; // 貫穿率 / 穿甲 %

/** A tab is either free-input (type values) or preset-pick (fixed values). */
export type TabMode = "free" | "preset";

export type TabId =
  | "equipment"
  | "medal"
  | "specialization"
  | "arcard"
  | "title"
  | "character"
  | "buff";

/** A typeable field inside a free-input tab (also used for the target panel). */
export interface FieldDef {
  /** A StatKey (aggregates) or a special key like "level" / "dmgValue". */
  key: string;
  label: string;
  en: string;
  pct?: boolean;
  step?: number;
  default?: number;
  hint?: string;
}

/** A fixed slot inside a preset tab (e.g. a 防具部位 or an AR-card position). */
export interface SlotDef {
  id: string;
  label: string;
  en?: string;
  /** Optional grouping header (e.g. 武器 / 防具 / 飾品 / 套裝 on the 裝備 tab). */
  group?: string;
}

export interface TabDef {
  id: TabId;
  label: string;
  en: string;
  mode: TabMode;
  /** free tabs */
  fields?: FieldDef[];
  /** preset tabs */
  slots?: SlotDef[];
  note?: string;
}

/** Fixed stat values carried by a preset item. */
export type Stats = Partial<Record<StatKey, number>>;

export interface Preset {
  id: string;
  name: string;
  stats: Stats;
}

/** One saved build. `values` holds free-tab + target inputs; `picks` holds preset selections. */
export interface ProfileData {
  values: Record<string, Record<string, number>>; // tabId | "target" -> fieldKey -> value
  picks: Record<string, Record<string, string | null>>; // tabId -> slotId -> presetId
}

export interface Profile {
  id: string;
  name: string;
  data: ProfileData;
}

export interface Workspace {
  activeId: string;
  profiles: Profile[];
}
