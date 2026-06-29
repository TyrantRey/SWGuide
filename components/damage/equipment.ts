// Builds the 裝備 tab from equipment.json + a per-piece editable model.
//
// Each gear piece is a card: 標籤 + 固定詞條(picked gear) + 附加詞條 + 鑲嵌道具.
// Set bonuses (套裝效果) auto-compute from equipped pieces (detectSets).
//
// 標籤 / 附加詞條 / 鑲嵌道具 are all "pick a stat from a pool + enter a value":
// the chosen stat lives in `picks`, the value in `values`. Pools depend on the
// piece kind (weapon / armor / accessory). Source: 入坑前.md. 靈魂石 ignored.
// Only damage-relevant stats are offered; D 球 (no damage stat) is shown empty.

import equipmentRaw from "./equipment.json";
import type { Preset, SlotDef, Stats, StatKey } from "./types";

const KEYS: StatKey[] = ["atkFlat", "atkPct", "critRate", "critDmg", "bDmg", "penetration"];

const STAT_MAP: Record<string, StatKey> = {
  攻擊力: "atkFlat",
  "攻擊力%": "atkPct",
  暴擊率: "critRate",
  暴擊傷害值: "critDmg",
  暴擊傷害量: "critDmg",
  "敵方附加傷害:BOSS": "bDmg",
  敵方防禦貫穿率: "penetration",
};

interface RawStat {
  stat: string;
  value: number | string;
}
interface RawSet {
  count: number;
  stats?: RawStat[];
  tier?: string;
}
interface RawPiece {
  slot: string;
  tier?: string;
  type?: string;
  name?: string;
  stats?: RawStat[];
}
interface RawAccGroup {
  name: string;
  perPiece?: RawStat[];
  pieces?: string[];
  set?: RawSet[];
}
interface RawSeries {
  id: string;
  name: string;
  weapons?: { tier?: string; stats?: RawStat[] }[];
  weaponSet?: RawSet[];
  armor?: { pieces?: RawPiece[]; set?: RawSet[] };
  accessories?: { pieces?: RawPiece[]; set?: RawSet[]; sets?: RawAccGroup[] };
  special?: { 固定詞條_掉落?: { piece: string; stats?: RawStat[] }[]; set?: RawSet[] };
}

const DATA = equipmentRaw as unknown as { series: RawSeries[] };

/* Per-series gear-set rules.
   key   — shared set-table id (狡猾/背叛 merge to "jb").
   weapon— does the weapon count toward the gear set?
   tier  — is the gear set split by tier (different numbers per tier)? */
const GEAR: Record<string, { key: string; weapon: boolean; tier: boolean }> = {
  cangui: { key: "cangui", weapon: true, tier: false },
  wangtu: { key: "wangtu", weapon: true, tier: false },
  zhuiyi: { key: "zhuiyi", weapon: true, tier: false },
  jiaohua: { key: "jb", weapon: true, tier: false },
  beipan: { key: "jb", weapon: true, tier: false },
  muguang: { key: "muguang", weapon: false, tier: true },
  zhuoyueshenpan: { key: "zhuoyue", weapon: false, tier: true },
  yulukaha: { key: "yulukaha", weapon: false, tier: false },
  huangjinlabiensi: { key: "huangjin", weapon: false, tier: false },
};

export const EQUIPMENT_SLOTS: SlotDef[] = [
  { id: "weapon", label: "武器", en: "WEAPON", group: "武器" },
  { id: "head", label: "頭盔", en: "HEAD", group: "防具" },
  { id: "shoulder", label: "護肩", en: "SHOULDER", group: "防具" },
  { id: "chest", label: "胸甲", en: "CHEST", group: "防具" },
  { id: "legs", label: "護腿", en: "LEGS", group: "防具" },
  { id: "pendant", label: "墜子", en: "PENDANT", group: "飾品" },
  { id: "earring", label: "耳環", en: "EARRING", group: "飾品" },
  { id: "ring1", label: "戒指 I", en: "RING I", group: "飾品" },
  { id: "ring2", label: "戒指 II", en: "RING II", group: "飾品" },
  { id: "belt", label: "腰帶", en: "BELT", group: "飾品" },
  { id: "bracelet", label: "手鐲", en: "BRACELET", group: "飾品" },
];

const ARMOR_SLOT: Record<string, string> = {
  頭盔: "head",
  護肩: "shoulder",
  胸甲: "chest",
  護甲: "chest",
  護腿: "legs",
};

function accSlot(name: string): string | null {
  if (name.includes("墜子")) return "pendant";
  if (name.includes("耳環")) return "earring";
  if (name.includes("戒指")) return "ring";
  return null;
}

function toStats(raw?: RawStat[]): Stats {
  const out: Stats = {};
  if (!raw) return out;
  for (const r of raw) {
    const key = STAT_MAP[r.stat];
    if (!key || typeof r.value !== "number") continue;
    out[key] = (out[key] ?? 0) + r.value;
  }
  return out;
}

function shortName(s: RawSeries): string {
  return s.name.replace("系列", "").replace("(梅霍拉)", "");
}

function gearSetId(s: RawSeries, tier?: string): string | null {
  const cfg = GEAR[s.id];
  if (!cfg) return null;
  return cfg.tier && tier ? `${cfg.key}:${tier}` : cfg.key;
}

let _seq = 0;
const uid = (p: string) => `${p}-${_seq++}`;

const weapon: Preset[] = [];
const head: Preset[] = [];
const shoulder: Preset[] = [];
const chest: Preset[] = [];
const legs: Preset[] = [];
const pendant: Preset[] = [];
const earring: Preset[] = [];
const ring: Preset[] = [];
const belt: Preset[] = [];
const bracelet: Preset[] = [];

const ARMOR_BUCKET: Record<string, Preset[]> = { head, shoulder, chest, legs };
const ACC_BUCKET: Record<string, Preset[]> = { pendant, earring, ring };

const OPTION_META: Record<string, { setId: string | null }> = {};
const SET_TABLES: Record<string, { count: number; stats: Stats }[]> = {};
const SET_NAMES: Record<string, string> = {};

function addOption(bucket: Preset[], name: string, stats: Stats, setId: string | null): void {
  const id = uid("opt");
  bucket.push({ id, name, stats });
  OPTION_META[id] = { setId };
}

function addSetTier(setId: string, name: string, count: number, stats: Stats): void {
  (SET_TABLES[setId] ??= []).push({ count, stats });
  if (!SET_NAMES[setId]) SET_NAMES[setId] = name;
}

for (const s of DATA.series) {
  const sn = shortName(s);
  const cfg = GEAR[s.id];
  const gearName = cfg?.key === "jb" ? "狡猾／背叛" : sn;

  for (const w of s.weapons ?? []) {
    const tier = w.tier && w.tier !== "單一" ? w.tier : "";
    const tierLabel = tier && tier.length <= 6 ? ` ${tier}` : "";
    const setId = cfg?.weapon ? gearSetId(s, tier || undefined) : null;
    addOption(weapon, `${sn}${tierLabel}`, toStats(w.stats), setId);
  }

  for (const p of s.armor?.pieces ?? []) {
    const slot = ARMOR_SLOT[p.slot];
    if (!slot) continue;
    const tierLabel = p.tier ? ` ${p.tier}` : "";
    addOption(ARMOR_BUCKET[slot], `${sn} ${p.slot}${tierLabel}`, toStats(p.stats), gearSetId(s, p.tier));
  }

  for (const p of s.accessories?.pieces ?? []) {
    const slot = accSlot(p.slot);
    if (!slot) continue;
    const typeLabel = p.type ? ` ${p.type}型` : "";
    addOption(ACC_BUCKET[slot], p.name || `${sn} ${p.slot}${typeLabel}`, toStats(p.stats), `acc:${s.id}`);
  }

  for (const g of s.accessories?.sets ?? []) {
    const accId = `acc:${s.id}:${g.name}`;
    for (const pieceName of g.pieces ?? []) {
      const slot = accSlot(pieceName);
      if (!slot) continue;
      addOption(ACC_BUCKET[slot], `${g.name} ${pieceName}`, toStats(g.perPiece), accId);
    }
    for (const st of g.set ?? []) addSetTier(accId, g.name, st.count, toStats(st.stats));
  }

  for (const p of s.special?.固定詞條_掉落 ?? []) {
    const bucket = p.piece === "腰帶" ? belt : bracelet;
    addOption(bucket, `${sn} ${p.piece}`, toStats(p.stats), "esp");
  }

  for (const st of s.armor?.set ?? []) {
    const id = gearSetId(s, st.tier);
    if (id) addSetTier(id, st.tier ? `${gearName} ${st.tier}` : gearName, st.count, toStats(st.stats));
  }
  for (const st of s.weaponSet ?? []) {
    const id = gearSetId(s, undefined);
    if (id) addSetTier(id, gearName, st.count, toStats(st.stats));
  }
  for (const st of s.accessories?.set ?? []) {
    addSetTier(`acc:${s.id}`, `${sn} 飾品`, st.count, toStats(st.stats));
  }
  for (const st of s.special?.set ?? []) {
    addSetTier("esp", sn, st.count, toStats(st.stats));
  }
}

/** Slot id → selectable gear options. ring1 / ring2 share the ring pool. */
export const EQUIPMENT_OPTIONS: Record<string, Preset[]> = {
  weapon,
  head,
  shoulder,
  chest,
  legs,
  pendant,
  earring,
  ring1: ring,
  ring2: ring,
  belt,
  bracelet,
};

export interface DetectedSet {
  id: string;
  name: string;
  count: number;
  stats: Stats;
}

/** Auto-detect active set bonuses from equipped picks (per-stat max per reached set). */
export function detectSets(picks: Record<string, string | null>): DetectedSet[] {
  const counts: Record<string, number> = {};
  for (const optId of Object.values(picks)) {
    if (!optId) continue;
    const setId = OPTION_META[optId]?.setId;
    if (!setId) continue;
    counts[setId] = (counts[setId] ?? 0) + 1;
  }

  const out: DetectedSet[] = [];
  for (const [setId, n] of Object.entries(counts)) {
    const table = SET_TABLES[setId];
    if (!table) continue;
    const minCount = Math.min(...table.map((e) => e.count));
    if (n < minCount) continue;
    const stats: Stats = {};
    for (const entry of table) {
      if (entry.count > n) continue;
      for (const k of KEYS) {
        const v = entry.stats[k];
        if (v != null) stats[k] = Math.max(stats[k] ?? 0, v);
      }
    }
    out.push({ id: setId, name: SET_NAMES[setId] ?? setId, count: n, stats });
  }
  return out;
}

/** Total stat contribution from all active sets (different sets stack). */
export function computeEquipmentSets(picks: Record<string, string | null>): Stats {
  const total: Stats = {};
  for (const s of detectSets(picks)) {
    for (const k of KEYS) if (s.stats[k] != null) total[k] = (total[k] ?? 0) + s.stats[k]!;
  }
  return total;
}

/* ============================================================
   Per-piece editable mods: 標籤 + 附加詞條 + 鑲嵌道具.
   ============================================================ */

export type GearKind = "weapon" | "armor" | "accessory";

const ARMOR_IDS = new Set(["head", "shoulder", "chest", "legs"]);
export function gearKind(slotId: string): GearKind {
  if (slotId === "weapon") return "weapon";
  if (ARMOR_IDS.has(slotId)) return "armor";
  return "accessory";
}

/** 標籤 詞條 pool by kind (武器標籤 武器攻擊力增加% → atkPct). */
export const TAG_POOL: Record<GearKind, StatKey[]> = {
  weapon: ["atkPct", "bDmg", "atkFlat"],
  armor: ["bDmg", "atkFlat", "critDmg"],
  accessory: ["bDmg", "atkFlat", "critDmg"],
};

/** 附加詞條 (random rolls) count + pool by kind. */
export const ATTR_COUNT = 3;
export const ATTR_POOL: Record<GearKind, StatKey[]> = {
  weapon: ["bDmg", "critDmg", "critRate", "penetration"],
  armor: ["atkFlat", "critDmg", "critRate"],
  accessory: ["atkFlat", "critDmg", "critRate", "penetration"],
};

/** 鑲嵌道具 sockets by kind (4 each for 武器/防具; 飾品 none). 入坑前 ABCD pools. */
export const BALLS: Record<GearKind, { id: string; label: string; pool: StatKey[] }[]> = {
  weapon: [
    { id: "1", label: "武器球 1", pool: ["critDmg", "atkFlat"] },
    { id: "2", label: "武器球 2", pool: ["critDmg", "atkFlat"] },
    { id: "3", label: "武器球 3", pool: ["critDmg", "atkFlat"] },
    { id: "4", label: "武器球 4", pool: ["critDmg", "atkFlat"] },
  ],
  armor: [
    { id: "A", label: "A 球", pool: ["critDmg"] },
    { id: "B", label: "B 球", pool: ["bDmg", "penetration"] },
    { id: "C", label: "C 球", pool: ["critDmg", "critRate"] },
    { id: "D", label: "D 球", pool: [] },
  ],
  accessory: [],
};

export const tagStatKey = (slot: string) => `tag:${slot}`;
export const tagValKey = (slot: string) => `tagv:${slot}`;
export const attrStatKey = (slot: string, i: number) => `attr:${slot}:${i}`;
export const attrValKey = (slot: string, i: number) => `attrv:${slot}:${i}`;
export const ballStatKey = (slot: string, ball: string) => `ball:${slot}:${ball}`;
export const ballValKey = (slot: string, ball: string) => `ballv:${slot}:${ball}`;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Seed keys: every stat-choice (picks → null) and value (values → 0). */
export const EQUIP_PICK_KEYS: string[] = [];
export const EQUIP_VAL_KEYS: string[] = [];
for (const slot of EQUIPMENT_SLOTS) {
  const kind = gearKind(slot.id);
  EQUIP_PICK_KEYS.push(tagStatKey(slot.id));
  EQUIP_VAL_KEYS.push(tagValKey(slot.id));
  for (const i of range(ATTR_COUNT)) {
    EQUIP_PICK_KEYS.push(attrStatKey(slot.id, i));
    EQUIP_VAL_KEYS.push(attrValKey(slot.id, i));
  }
  for (const b of BALLS[kind]) {
    if (!b.pool.length) continue;
    EQUIP_PICK_KEYS.push(ballStatKey(slot.id, b.id));
    EQUIP_VAL_KEYS.push(ballValKey(slot.id, b.id));
  }
}

function addEntry(out: Stats, pool: StatKey[], stat: string | null, val: number | undefined): void {
  if (!stat || !val || !pool.includes(stat as StatKey)) return;
  const k = stat as StatKey;
  out[k] = (out[k] ?? 0) + val;
}

/** Sum every per-piece 標籤 + 附加詞條 + 鑲嵌道具 into damage stats. */
export function computePieceMods(
  picks: Record<string, string | null>,
  values: Record<string, number>,
): Stats {
  const out: Stats = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const kind = gearKind(slot.id);
    addEntry(out, TAG_POOL[kind], picks[tagStatKey(slot.id)] ?? null, values[tagValKey(slot.id)]);
    for (const i of range(ATTR_COUNT)) {
      addEntry(out, ATTR_POOL[kind], picks[attrStatKey(slot.id, i)] ?? null, values[attrValKey(slot.id, i)]);
    }
    for (const b of BALLS[kind]) {
      addEntry(out, b.pool, picks[ballStatKey(slot.id, b.id)] ?? null, values[ballValKey(slot.id, b.id)]);
    }
  }
  return out;
}
