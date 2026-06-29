// Tab/stat configuration + aggregation for the damage calculator.
//
// DESIGN STATE (scaffold):
//   - The damage FORMULA is not implemented yet (DamageCalculator shows ⟨待公式⟩).
//   - PRESETS hold only a few EXAMPLES so the picker is reviewable; the full
//     per-item / per-slot data is filled in later.
//   - Free tabs (武器/角色/特化) take typed values; preset tabs (勳章/AR卡/稱號/增益)
//     pick fixed-value items. Aggregation simply sums every contribution.

import type {
  FieldDef,
  Preset,
  ProfileData,
  StatKey,
  TabDef,
  TabId,
} from "./types";
import {
  computeEquipmentSets,
  computePieceMods,
  EQUIP_PICK_KEYS,
  EQUIP_VAL_KEYS,
  EQUIPMENT_OPTIONS,
  EQUIPMENT_SLOTS,
} from "./equipment";
import { computeMedalStats, MEDAL_PICK_KEYS } from "./medals";
import { computeSpecStats, SPEC_VAL_KEYS } from "./specialization";

/** Stats that aggregate. A free-tab field whose key is one of these contributes. */
export const STAT_KEYS: StatKey[] = [
  "atkFlat",
  "atkPct",
  "critRate",
  "critDmg",
  "bDmg",
  "penetration",
];

export const STAT_META: Record<StatKey, { label: string; en: string; pct: boolean }> = {
  atkFlat: { label: "攻擊力", en: "ATK", pct: false },
  atkPct: { label: "攻擊力", en: "ATK %", pct: true },
  critRate: { label: "暴擊率", en: "CRIT %", pct: true },
  critDmg: { label: "暴擊傷害", en: "CRIT DMG", pct: false },
  bDmg: { label: "傷害增加", en: "B傷 %", pct: true },
  penetration: { label: "貫穿率", en: "PEN %", pct: true },
};

function statField(key: StatKey, extra?: Partial<FieldDef>): FieldDef {
  const m = STAT_META[key];
  return { key, label: m.label, en: m.en, pct: m.pct, ...extra };
}

/** Left-rail tabs, in display order: 角色 → 裝備 → 稱號 → 特化 → AR卡 → 增益（勳章 暫置末）. */
export const TABS: TabDef[] = [
  {
    id: "character",
    label: "角色",
    en: "CHARACTER",
    mode: "free",
    note: "角色基礎面板：等級與基礎屬性。",
    fields: [
      { key: "level", label: "等級", en: "LEVEL", default: 0, step: 1, hint: "用於防禦減傷計算。" },
      statField("atkFlat", { step: 100 }),
      statField("critRate"),
      statField("critDmg", { step: 50 }),
      statField("penetration"),
    ],
  },
  {
    id: "equipment",
    label: "裝備",
    en: "EQUIPMENT",
    mode: "preset",
    // 選項由 equipment.json（〈防具裝備篇〉）產生：武器 + 防具 + 飾品的固定詞條與套裝效果。
    // 僅帶入傷害相關詞條（攻擊力／暴擊／敵方附加傷害BOSS／貫穿）；隨機詞條請另行於面板核對。
    note: "依部位選擇裝備，固定詞條自動帶入；套裝效果依同系列件數自動計算。",
    slots: EQUIPMENT_SLOTS,
  },
  {
    id: "title",
    label: "稱號",
    en: "TITLE",
    mode: "preset",
    note: "選擇啟用中的稱號。",
    slots: [{ id: "title", label: "稱號", en: "TITLE" }],
  },
  {
    id: "specialization",
    label: "特化",
    en: "SPEC",
    mode: "free",
    note: "技能／SA 倍率（預設 100%）＋ 戰鬥／技術特化配點，可分配特化點數。",
    // Rendered by SpecializationPanel (custom). dmgValue/saValue stay here so the
    // formula keeps its 100% defaults; node points live under their own keys.
    fields: [
      {
        key: "dmgValue",
        label: "傷害值",
        en: "DMG VALUE %",
        pct: true,
        default: 100,
        step: 5,
        hint: "技能傷害倍率，預設 100%。",
      },
      {
        key: "saValue",
        label: "SA 傷害值",
        en: "SA VALUE %",
        pct: true,
        default: 100,
        step: 5,
        hint: "破壞／霸體傷害倍率，預設 100%。",
      },
    ],
  },
  {
    id: "arcard",
    label: "AR卡",
    en: "AR CARD",
    mode: "preset",
    note: "5 張 AR 卡 + 1 張核心。",
    slots: [
      { id: "c1", label: "AR 卡 1" },
      { id: "c2", label: "AR 卡 2" },
      { id: "c3", label: "AR 卡 3" },
      { id: "c4", label: "AR 卡 4" },
      { id: "c5", label: "AR 卡 5" },
      { id: "core", label: "核心", en: "CORE" },
    ],
  },
  {
    id: "buff",
    label: "增益",
    en: "BUFF",
    mode: "preset",
    note: "可同時掛載多個增益。",
    slots: [
      { id: "b1", label: "增益 1" },
      { id: "b2", label: "增益 2" },
      { id: "b3", label: "增益 3" },
      { id: "b4", label: "增益 4" },
    ],
  },
  {
    id: "medal",
    label: "勳章",
    en: "MEDAL",
    mode: "preset",
    // Rendered by MedalPanel (custom cascade), aggregated via computeMedalStats.
    // 每部位：選稀有度 (GB／TB) → 型號 (SD/BSK/FOT/SIN) → 3 顆勳章；套裝效果自動帶入。
    // 僅含攻擊型勳章與傷害相關數值；非傷害／條件觸發效果未納入。
    note: "選稀有度（GB／TB）與型號，挑各部位 3 顆勳章，套裝效果自動帶入。",
  },
];

/** Selectable characters (content/post/角色篇). Identity only — base stats stay manual. */
export const CHARACTERS: { id: string; name: string; weapon: string }[] = [
  { id: "haru", name: "哈露・伊絲提亞", weapon: "大劍" },
  { id: "erwin", name: "歐文・阿克萊特", weapon: "手槍" },
  { id: "lily", name: "莉莉・普露梅茜", weapon: "鐮刀" },
  { id: "jin", name: "金・希帕斯", weapon: "拳套" },
  { id: "stella", name: "史黛菈・優妮貝爾", weapon: "吉他" },
  { id: "iris", name: "伊莉絲・悠娜", weapon: "錘" },
  { id: "chii", name: "琪・阿露爾", weapon: "武士刀" },
  { id: "ephnel", name: "艾芙妮爾", weapon: "長槍" },
  { id: "nabi", name: "李娜飛", weapon: "步槍" },
  { id: "dhana", name: "朵娜・奧妃婗", weapon: "雙手劍" },
];

/** Enemy/target inputs — shown in the result rail, not a left tab. */
export const TARGET_FIELDS: FieldDef[] = [
  { key: "defense", label: "防禦度", en: "DEFENSE", default: 0, step: 100 },
  { key: "bossReduction", label: "BOSS減傷", en: "BOSS DR %", pct: true, default: 0 },
  { key: "attackFail", label: "攻擊失敗倍率", en: "MISS MULT %", pct: true, default: 50 },
];

/**
 * Preset registry — keyed by tab.
 *
 * EXAMPLES ONLY. Replace / extend with full game data later (default values TBD).
 * Each preset's `stats` are FIXED and render read-only when selected. Medal/AR-card
 * values are part-specific in-game; the per-slot data model can be refined when the
 * real numbers are added.
 */
export const PRESETS: Partial<Record<TabId, Preset[]>> = {
  buff: [
    { id: "buff-atk20", name: "範例：攻擊力 +20%", stats: { atkPct: 20 } },
    { id: "buff-crit10", name: "範例：暴擊率 +10%", stats: { critRate: 10 } },
    { id: "buff-bdmg15", name: "範例：傷害增加 +15%", stats: { bDmg: 15 } },
  ],
  title: [{ id: "title-sample", name: "範例稱號（攻擊力 +5%）", stats: { atkPct: 5 } }],
  // medal: custom cascade (MedalPanel + computeMedalStats), not this shared list.
  // arcard: per-slot fixed values — fill in later (same shape as above).
  arcard: [],
};

/** Options for a preset tab's slot. 裝備 is per-slot (equipment.json); others share one list. */
export function presetsFor(tabId: string, slotId: string): Preset[] {
  if (tabId === "equipment") return EQUIPMENT_OPTIONS[slotId] ?? [];
  return PRESETS[tabId as TabId] ?? [];
}

export function defaultProfileData(): ProfileData {
  const values: ProfileData["values"] = {};
  const picks: ProfileData["picks"] = {};
  for (const tab of TABS) {
    if (tab.mode === "free" && tab.fields) {
      values[tab.id] = {};
      for (const f of tab.fields) values[tab.id][f.key] = f.default ?? 0;
    }
    if (tab.mode === "preset" && tab.slots) {
      picks[tab.id] = {};
      for (const s of tab.slots) picks[tab.id][s.id] = null;
    }
  }
  values.target = {};
  for (const f of TARGET_FIELDS) values.target[f.key] = f.default ?? 0;
  values.equipment = {};
  for (const k of EQUIP_VAL_KEYS) values.equipment[k] = 0;
  picks.equipment ??= {};
  for (const k of EQUIP_PICK_KEYS) picks.equipment[k] = null;
  picks.character = { char: null };
  // 特化 node points + SP pool (keep dmgValue/saValue seeded above).
  values.specialization ??= {};
  for (const k of SPEC_VAL_KEYS) values.specialization[k] ??= 0;
  // 勳章 cascade picks (per-part 型號／稀有度 + 3 medal slots).
  picks.medal = {};
  for (const k of MEDAL_PICK_KEYS) picks.medal[k] = null;
  return { values, picks };
}

export interface Aggregate {
  stats: Record<StatKey, number>;
  level: number;
  dmgValue: number;
  saValue: number;
  target: { defense: number; bossReduction: number; attackFail: number };
}

/** Sum every source into total stats. The damage formula consumes this later. */
export function aggregate(data: ProfileData): Aggregate {
  const stats: Record<StatKey, number> = {
    atkFlat: 0,
    atkPct: 0,
    critRate: 0,
    critDmg: 0,
    bDmg: 0,
    penetration: 0,
  };

  for (const tab of TABS) {
    if (tab.id === "medal") continue; // custom cascade — handled below
    if (tab.mode === "free") {
      const v = data.values[tab.id] ?? {};
      for (const k of STAT_KEYS) if (v[k]) stats[k] += v[k];
    } else {
      const slotPicks = data.picks[tab.id] ?? {};
      for (const [slotId, presetId] of Object.entries(slotPicks)) {
        if (!presetId) continue;
        const preset = presetsFor(tab.id, slotId).find((p) => p.id === presetId);
        if (!preset) continue;
        for (const k of STAT_KEYS) if (preset.stats[k]) stats[k] += preset.stats[k]!;
      }
    }
  }

  // 勳章 (medals): individual medal stats + per-part set bonuses (when 3 slots filled)
  const medalStats = computeMedalStats(data.picks.medal);
  for (const k of STAT_KEYS) if (medalStats[k]) stats[k] += medalStats[k]!;

  // auto set bonuses from equipped 裝備 pieces
  const setStats = computeEquipmentSets(data.picks.equipment ?? {});
  for (const k of STAT_KEYS) if (setStats[k]) stats[k] += setStats[k]!;

  // 裝備 標籤 + 附加詞條 + 鑲嵌道具 (selectable stat + value, per piece)
  const mods = computePieceMods(data.picks.equipment ?? {}, data.values.equipment ?? {});
  for (const k of STAT_KEYS) if (mods[k]) stats[k] += mods[k]!;

  // 特化 node allocation (per-point contributions; master caps scale with 角色等級)
  const specStats = computeSpecStats(data.values.specialization, data.values.character?.level ?? 0);
  for (const k of STAT_KEYS) if (specStats[k]) stats[k] += specStats[k]!;

  return {
    stats,
    level: data.values.character?.level ?? 0,
    dmgValue: data.values.specialization?.dmgValue ?? 100,
    saValue: data.values.specialization?.saValue ?? 100,
    target: {
      defense: data.values.target?.defense ?? 0,
      bossReduction: data.values.target?.bossReduction ?? 0,
      attackFail: data.values.target?.attackFail ?? 50,
    },
  };
}
