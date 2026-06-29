// 特化 (Specialization) tree — the interactive point-allocation grid that mirrors
// the in-game 特化 screen: two trees (戰鬥特化 / 技術特化), each with a 5-node
// master row plus 3 tiers of 3 mutually-exclusive nodes (choose one per tier).
// Allocated points feed the damage aggregate through each node's per-point `per`.
//
// DATA STATE — both trees (戰鬥特化 / 技術特化), masters + tiers, now hold real names
// and effects. The only unconfirmed values are the unlock gates (`req`) and SP cost
// (`sp`, currently 1/點) — see MASTER_REQ / TIER_REQ. To edit a node:
//   name : in-game skill name (shown under the icon)
//   icon : cosmetic glyph (see SpecIconKey)
//   max  : level cap — a fixed per-skill cap (masters: 85/81/76/55/30; tiers: 1),
//          or 角色等級 when opts.levelCap is set (the level-cap path is currently unused)
//   sp   : SP cost per point — drives 已用／剩餘 SP and the SP不足 state
//   per  : stat gained PER point, e.g. { atkPct: 1 } → +1% 攻擊力 per level.
//          Leave {} for a node with no damage-relevant effect (命中度／生命值／迴避度／攻速 → 0).
//   step : optional 每N點 bonus on top of `per` (see SpecStep), e.g. 攻擊力 +5% 每5點.
//   desc : full effect text shown as the tile tooltip (for {} / conditional nodes).
// Tier nodes are choose-one: raising one in the UI clears its tier siblings.

import type { Stats, StatKey } from "./types";

export type SpecIconKey =
  | "sword"
  | "swords"
  | "target"
  | "armor"
  | "hook"
  | "drop"
  | "heart"
  | "star"
  | "flame"
  | "bolt"
  | "up"
  | "down";

/**
 * Step bonus on top of the linear `per`: every `every` points fully invested grants
 * `per` once more. Models the in-game「每5點」jump, e.g. 攻擊力 +1%/點 plus +5% extra
 * each 5th point ⇒ LV4 = 4%, LV5 = 10%. Contribution = per×pts + step.per×⌊pts/every⌋.
 */
export interface SpecStep {
  every: number;
  per: Stats;
}

export interface SpecNode {
  id: string;
  name: string;
  icon: SpecIconKey;
  /** Which tree the node belongs to (injected below; drives per-tree unlock). */
  tree: "combat" | "tech";
  /** Level cap: a fixed per-skill cap when `levelCap` is false, else 角色等級 (see nodeMax). */
  max: number;
  /** True ⇒ effective cap = 角色等級; false ⇒ use the fixed `max` (combat masters + tiers). */
  levelCap: boolean;
  /** SP cost per point. */
  sp: number;
  /**
   * Points already invested IN THIS TREE before the node unlocks.
   * 戰鬥1/技術1 = 0；戰鬥/技術 2–5 = 5/10/30/50；Tier 1–3 = 60/100/140.
   */
  req: number;
  /** Stat gained per allocated point (linear). {} = no damage effect yet. */
  per: Stats;
  /** Optional 每N點 step bonus added on top of `per` (see SpecStep). */
  step?: SpecStep;
  /** Full in-game effect text (shown as the tile tooltip); useful when `per` is {} or conditional. */
  desc?: string;
}

export interface SpecTier {
  id: string;
  label: string;
  /** The 3 mutually-exclusive choices for this tier. */
  nodes: SpecNode[];
}

export interface SpecTree {
  id: "combat" | "tech";
  name: string;
  en: string;
  /** Independent top-row skills. */
  masters: SpecNode[];
  /** Tiered passives (choose one per tier). */
  tiers: SpecTier[];
}

const STAT_KEYS: StatKey[] = ["atkFlat", "atkPct", "critRate", "critDmg", "bDmg", "penetration"];

/** SP pool = 角色等級 × SP_PER_LEVEL − SP_LEVEL_OFFSET (Lv 85 → 253). Each 戰鬥/技術
 *  master passive's level cap = 角色等級 (≤ MAX_LEVEL); tiers keep their static `max` (1). See nodeMax. */
export const SP_PER_LEVEL = 3;
/** Flat points subtracted from the per-level pool (角色等級 ×3 −2 = 特化技能點數). */
export const SP_LEVEL_OFFSET = 2;
export const MAX_LEVEL = 85;

/** Per-tree unlock thresholds (points already invested in the same tree).
 *  Masters 2–5 gate at 5/10/30/50; Tiers 1–3 gate at 60/100/140 and are 3-choose-1
 *  passives costing 1 點 each. */
const MASTER_REQ = [0, 5, 10, 30, 50];
const TIER_REQ = [60, 100, 140];

/**
 * Build a node. `tree` is a stub here and rewritten per tree below; `req` is the
 * unlock gate (see SpecNode). `opts.levelCap` makes the cap = 角色等級 (else fixed
 * `max`); `opts.step` adds the 每N點 bonus. 戰鬥 masters carry real data; the rest
 * are still placeholders awaiting numbers.
 */
function n(
  id: string,
  name: string,
  icon: SpecIconKey,
  max: number,
  sp: number,
  req: number,
  per: Stats = {},
  opts: { levelCap?: boolean; step?: SpecStep; desc?: string } = {},
): SpecNode {
  return {
    id,
    name,
    icon,
    tree: "combat",
    max,
    levelCap: opts.levelCap ?? false,
    sp,
    req,
    per,
    step: opts.step,
    desc: opts.desc,
  };
}

export const SPEC_TREES: SpecTree[] = [
  {
    id: "combat",
    name: "戰鬥特化",
    en: "COMBAT",
    masters: [
      // 攻擊力增加：+1%/點，每5點額外 +5%（LV4=4%、LV5=10%）。MAX 85 → 170%。
      n("c-m1", "攻擊力增加", "sword", 85, 1, MASTER_REQ[0], { atkPct: 1 }, { step: { every: 5, per: { atkPct: 5 } } }),
      // 命中度：+1 命中/點，每5點額外 +5（命中非傷害屬性，僅顯示不計入加成）。MAX 81。
      n("c-m2", "命中度", "target", 81, 1, MASTER_REQ[1]),
      // 生命值增加：+1%/點，每5點額外 +5%（生命值非傷害屬性，僅顯示不計入加成）。MAX 76。
      n("c-m3", "生命值增加", "heart", 76, 1, MASTER_REQ[2]),
      // 暴擊率增加：+0.15%/點，每5點額外 +1%（LV5=1.75%）。MAX 55 → 19.25%。
      n("c-m4", "暴擊率增加", "star", 55, 1, MASTER_REQ[3], { critRate: 0.15 }, { step: { every: 5, per: { critRate: 1 } } }),
      // BOSS附加傷害增加：+0.2%/點，每5點額外 +1%（LV5=2%）。MAX 30 → 12%。
      n("c-m5", "BOSS附加傷害增加", "flame", 30, 1, MASTER_REQ[4], { bDmg: 0.2 }, { step: { every: 5, per: { bDmg: 1 } } }),
    ],
    tiers: [
      {
        id: "c-t1",
        label: "TIER 1",
        nodes: [
          // 恢復系，非傷害屬性 → 不計入加成。
          n("c-t1a", "戰鬥呼吸", "drop", 1, 1, TIER_REQ[0], {}, { desc: "暴擊攻擊時，靈魂值恢復 5%（冷卻 3 秒）" }),
          n("c-t1b", "嗜血", "heart", 1, 1, TIER_REQ[0], {}, { desc: "擊敗敵人時，體力恢復 10%（冷卻 15 秒）" }),
          // 被動，攻擊力 +30%。
          n("c-t1c", "身體強化", "sword", 1, 1, TIER_REQ[0], { atkPct: 30 }, { desc: "攻擊力增加 30%（被動）" }),
        ],
      },
      {
        id: "c-t2",
        label: "TIER 2",
        nodes: [
          // 條件觸發（遭受攻擊時），視為觸發後狀態計入 → 攻擊力 +50%。
          n("c-t2a", "憤怒", "flame", 1, 1, TIER_REQ[1], { atkPct: 50 }, { desc: "遭到攻擊時，攻擊力增加 50%（持續 10 秒，可更新）" }),
          n("c-t2b", "起死回生", "heart", 1, 1, TIER_REQ[1], {}, { desc: "體力低於 20% 時，體力恢復 50%（冷卻 60 秒）" }),
          // 被動 HP，非傷害屬性 → 不計入加成。
          n("c-t2c", "強硬身軀", "armor", 1, 1, TIER_REQ[1], {}, { desc: "生命值增加 50%（被動）" }),
        ],
      },
      {
        id: "c-t3",
        label: "TIER 3",
        nodes: [
          n("c-t3a", "精通渴望", "drop", 1, 1, TIER_REQ[2], {}, { desc: "戰鬥開始時，SV 恢復 100" }),
          // 條件觸發（戰鬥開始 60 秒），視為觸發後狀態計入 → BOSS附加傷害 +30%。
          n("c-t3b", "宣戰", "flame", 1, 1, TIER_REQ[2], { bDmg: 30 }, { desc: "戰鬥開始時，60 秒間 BOSS附加傷害增加 30%" }),
          // 被動，BOSS附加傷害 +15%。
          n("c-t3c", "獵人首領", "target", 1, 1, TIER_REQ[2], { bDmg: 15 }, { desc: "BOSS附加傷害增加 15%（被動）" }),
        ],
      },
    ],
  },
  {
    id: "tech",
    name: "技術特化",
    en: "TECHNIQUE",
    masters: [
      // 暴擊率增加：+0.15%/點，每5點額外 +1%（LV5=1.75%）。MAX 85 → 29.75%。
      n("t-m1", "暴擊率增加", "star", 85, 1, MASTER_REQ[0], { critRate: 0.15 }, { step: { every: 5, per: { critRate: 1 } } }),
      // 暴擊傷害值增加：+2/點（爆擊附加攻擊「值」，flat — 見傷害篇），每5點額外 +6（LV5=8）。MAX 81 → 258。
      n("t-m2", "暴擊傷害值增加", "swords", 81, 1, MASTER_REQ[1], { critDmg: 2 }, { step: { every: 5, per: { critDmg: 6 } } }),
      // 迴避度增加：+1 迴避/點，每5點額外 +5（迴避非傷害屬性，僅顯示不計入加成）。MAX 76。
      n("t-m3", "迴避度增加", "hook", 76, 1, MASTER_REQ[2]),
      // 攻擊速度增加：+0.1%/點，每5點額外 +0.5%（攻速影響 DPS 而非單發傷害，不計入加成）。MAX 55。
      n("t-m4", "攻擊速度增加", "bolt", 55, 1, MASTER_REQ[3]),
      // 防禦力貫穿增加：+0.1%/點，每5點額外 +0.5%（LV5=0.6%）。MAX 30 → 6%。
      n("t-m5", "防禦力貫穿增加", "target", 30, 1, MASTER_REQ[4], { penetration: 0.1 }, { step: { every: 5, per: { penetration: 0.5 } } }),
    ],
    tiers: [
      // 技術 tier 全為命中度／迴避度／靈魂·耐力·SV 恢復／攻擊速度 — 皆非傷害屬性，不計入加成（僅顯示效果）。
      {
        id: "t-t1",
        label: "TIER 1",
        nodes: [
          n("t-t1a", "從容應戰", "drop", 1, 1, TIER_REQ[0], {}, { desc: "使用技能時，靈魂值恢復 5%（冷卻 5 秒）" }),
          n("t-t1b", "深呼吸", "heart", 1, 1, TIER_REQ[0], {}, { desc: "迴避時，耐力恢復 10%（冷卻 10 秒）" }),
          n("t-t1c", "精準", "target", 1, 1, TIER_REQ[0], {}, { desc: "命中度增加 100（被動）" }),
        ],
      },
      {
        id: "t-t2",
        label: "TIER 2",
        nodes: [
          n("t-t2a", "生存本能", "heart", 1, 1, TIER_REQ[1], {}, { desc: "體力低於 20% 時，迴避度增加 1000" }),
          n("t-t2b", "把握機會", "drop", 1, 1, TIER_REQ[1], {}, { desc: "怪物霸體遭破壞時，靈魂值恢復 100%" }),
          n("t-t2c", "步步為營", "hook", 1, 1, TIER_REQ[1], {}, { desc: "迴避度增加 100（被動）" }),
        ],
      },
      {
        id: "t-t3",
        label: "TIER 3",
        nodes: [
          n("t-t3a", "渴望", "drop", 1, 1, TIER_REQ[2], {}, { desc: "戰鬥開始時，SV 恢復 100" }),
          n("t-t3b", "暴走", "flame", 1, 1, TIER_REQ[2], {}, { desc: "成功暴擊時，攻擊速度增加 30%（持續 10 秒，冷卻 50 秒）" }),
          n("t-t3c", "神速攻擊", "bolt", 1, 1, TIER_REQ[2], {}, { desc: "攻擊速度增加 10%（被動）" }),
        ],
      },
    ],
  },
];

// Inject the owning tree (levelCap is set per node in n()).
for (const tree of SPEC_TREES) {
  for (const node of tree.masters) node.tree = tree.id;
  for (const tier of tree.tiers) for (const node of tier.nodes) node.tree = tree.id;
}

/** Flat list of every node (for aggregation + seeding). */
export const SPEC_NODES: SpecNode[] = SPEC_TREES.flatMap((t) => [
  ...t.masters,
  ...t.tiers.flatMap((tier) => tier.nodes),
]);

/** Key in values.specialization holding 技能頁面 passive points (deducted from the pool). */
export const SPEC_PASSIVE_KEY = "__passive";

/** Value keys this tab seeds in a fresh profile (node points + passive deduction). */
export const SPEC_VAL_KEYS: string[] = [...SPEC_NODES.map((node) => node.id), SPEC_PASSIVE_KEY];

/** Available specialization pool: min(等級, 上限) ×3 −2 − 技能頁面被動點數 (never below 0).
 *  等級夾在 MAX_LEVEL 以內（Lv 85 → 253 點）。 */
export function specPool(level: number, passive: number): number {
  const lv = Math.min(MAX_LEVEL, Math.max(0, Math.floor(level)));
  const base = lv * SP_PER_LEVEL - SP_LEVEL_OFFSET;
  return Math.max(0, base - Math.max(0, Math.floor(passive)));
}

/** Effective level cap for a node: its fixed `max`, or 角色等級 when `levelCap` is set. */
export function nodeMax(node: SpecNode, level: number): number {
  if (!node.levelCap) return node.max;
  return Math.min(MAX_LEVEL, Math.max(0, Math.floor(level)));
}

/** Allocated points for a node, clamped to [0, nodeMax]. */
export function specPoints(values: Record<string, number>, node: SpecNode, level: number): number {
  const raw = values[node.id] ?? 0;
  return Math.max(0, Math.min(nodeMax(node, level), Math.floor(raw)));
}

/** Total SP spent across every node (both trees share one pool). */
export function specSpent(values: Record<string, number>, level: number): number {
  let sp = 0;
  for (const node of SPEC_NODES) sp += specPoints(values, node, level) * node.sp;
  return sp;
}

/** SP invested within one tree (drives the per-tree unlock gates). */
export function treeSpent(values: Record<string, number>, tree: SpecNode["tree"], level: number): number {
  let sp = 0;
  for (const node of SPEC_NODES) if (node.tree === tree) sp += specPoints(values, node, level) * node.sp;
  return sp;
}

/**
 * Is this node's unlock gate met? Counts SP already in its tree EXCLUDING the
 * node itself, so a node can never satisfy its own prerequisite.
 */
export function nodeUnlocked(values: Record<string, number>, node: SpecNode, level: number): boolean {
  if (node.req <= 0) return true;
  const own = specPoints(values, node, level) * node.sp;
  return treeSpent(values, node.tree, level) - own >= node.req;
}

/**
 * Lowest point count `node` may be reduced to without orphaning another node: removing
 * SP that a *currently-unlocked* same-tree node relies on (its req gate) would lock it,
 * so − clamps here. e.g. 特化1=10、特化2=5(需5) → 特化1 only goes down to 5, not 0.
 */
export function minNodePoints(
  values: Record<string, number>,
  node: SpecNode,
  level: number,
): number {
  if (node.sp <= 0) return 0;
  const tree = treeSpent(values, node.tree, level);
  const own = specPoints(values, node, level) * node.sp;
  let floor = 0;
  for (const other of SPEC_NODES) {
    if (other.id === node.id || other.tree !== node.tree || other.req <= 0) continue;
    const pts = specPoints(values, other, level);
    if (pts <= 0 || !nodeUnlocked(values, other, level)) continue;
    // SP left in this tree once both `node` and `other`'s own contributions are removed;
    // `node` must refill the gap up to other.req.
    const without = tree - own - pts * other.sp;
    const needed = Math.ceil((other.req - without) / node.sp);
    if (needed > floor) floor = needed;
  }
  return Math.max(0, floor);
}

/** One node's stat output at `pts` points: linear `per`×pts plus the 每N點 step bonus. */
export function nodeStats(node: SpecNode, pts: number): Stats {
  const out: Stats = {};
  if (pts <= 0) return out;
  const steps = node.step ? Math.floor(pts / node.step.every) : 0;
  for (const k of STAT_KEYS) {
    const lin = (node.per[k] ?? 0) * pts;
    const stp = steps > 0 ? (node.step!.per[k] ?? 0) * steps : 0;
    if (lin || stp) out[k] = lin + stp;
  }
  return out;
}

/** Stat contribution from current allocation (each node's nodeStats, summed). Locked nodes don't count. */
export function computeSpecStats(values: Record<string, number> | undefined, level: number): Stats {
  const out: Stats = {};
  if (!values) return out;
  for (const node of SPEC_NODES) {
    const pts = specPoints(values, node, level);
    if (!pts || !nodeUnlocked(values, node, level)) continue;
    const ns = nodeStats(node, pts);
    for (const k of STAT_KEYS) if (ns[k]) out[k] = (out[k] ?? 0) + ns[k]!;
  }
  return out;
}

/** True once any node has real effect data (linear or step) — drives the summary's empty state. */
export const SPEC_HAS_EFFECTS = SPEC_NODES.some(
  (node) => STAT_KEYS.some((k) => node.per[k] || node.step?.per[k]),
);
