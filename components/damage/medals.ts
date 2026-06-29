// 勳章 (medals) — data + aggregation for the 勳章 tab's cascade:
//   稀有度 (GB／TB) → 型號 (SD/BSK/FOT/SIN) → 3 顆個別勳章 → 套裝效果自動帶入.
// Source: content/post/系統/勳章篇/ (勳章目錄 set-bonus table + per-型號 medal docs).
//
// SCOPE — only GB (GIGA) and TB (TERA) rarities (MB/BIT/KB omitted). This is a
// THEORETICAL-MAX calculator: any effect that maps to a damage stat goes into `stats`
// at its FULL value, even conditional self-buffs (機率／持續時間 procs, e.g. 滲透 暴擊時
// +10% 貫穿 → penetration 10; 搖擺 迴避後 +70% 攻擊力 → atkPct 70). The damage stats are
// 攻擊力／攻擊力%／暴擊率／暴擊傷害／貫穿，以及「敵方附加傷害：BOSS/中級怪物」→ B傷.
// Still NOT aggregated: non-damage effects (命中度／迴避／SA破壞力／HP／防禦／攻速…) and
// situational enemy-type/state 附加傷害 (一般／空中／倒地) — they're enemy-dependent, not
// self-buffs. Each medal's full effect text lives in `desc`.
// All four 型號 (SD/BSK/FOT/SIN) are fully transcribed (TB+GB, theoretical-max). FOT 防禦型
// has no damage stat so it stays name-only; everything else carries desc + damage stats.

import type { Stats, StatKey } from "./types";

const STAT_KEYS: StatKey[] = ["atkFlat", "atkPct", "critRate", "critDmg", "bDmg", "penetration"];

export const MEDAL_TYPES = ["SD", "BSK", "FOT", "SIN"] as const;
export type MedalType = (typeof MEDAL_TYPES)[number];

export const MEDAL_RARITIES = ["GB", "TB"] as const;
export type MedalRarity = (typeof MEDAL_RARITIES)[number];

export const MEDAL_RARITY_LABEL: Record<MedalRarity, string> = { GB: "GIGA", TB: "TERA" };

/** Armor parts — one set-bonus context each, with 3 medal slots. */
export const MEDAL_PARTS = [
  { id: "head", label: "頭部", en: "HEAD" },
  { id: "top", label: "上衣", en: "TOP" },
  { id: "hands", label: "手", en: "HANDS" },
  { id: "legs", label: "下裝", en: "LEGS" },
  { id: "shoes", label: "鞋子", en: "SHOES" },
] as const;
type MedalPart = (typeof MEDAL_PARTS)[number]["id"];

export const MEDAL_SLOTS = 3;

/** Medal categories. The 3 slots are fixed: 攻擊型 / 防禦型 / 功能型 (in order). */
export type MedalCat = "atk" | "def" | "fn";
export const SLOT_CATEGORIES: MedalCat[] = ["atk", "def", "fn"];
export const CAT_LABEL: Record<MedalCat, string> = { atk: "攻擊型", def: "防禦型", fn: "功能型" };

export interface MedalDef {
  id: string; // unique within its (型號, 稀有度, 類別) pool
  name: string;
  cat: MedalCat;
  stats: Stats;
  /** Full in-game effect text (shown in the picker). Damage subset lives in `stats`. */
  desc?: string;
}

interface CatPools {
  atk: MedalDef[];
  def: MedalDef[];
  fn: MedalDef[];
}

// `withDesc` — full medal with an explicit effect description (used by every 型號 now).
// `names` — name-only medals (no description / no damage stat; e.g. FOT 防禦型).
const withDesc =
  (cat: MedalCat) =>
  (name: string, desc: string, stats: Stats = {}): MedalDef => ({ id: name, name, cat, stats, desc });
const atk = withDesc("atk");
const def = withDesc("def");
const fn = withDesc("fn");
const names = (cat: MedalCat, list: string[]): MedalDef[] =>
  list.map((n) => ({ id: n, name: n, cat, stats: {} }));

/* ── SD：完整勳章（攻擊／防禦／功能，含說明）；來源〈SD 勳章〉。stats 僅取傷害子集。 ── */
const SD_TB: CatPools = {
  atk: [
    atk("鷹眼", "命中度 +52"),
    atk("致命", "暴擊傷害值 +700", { critDmg: 700 }),
    atk("破碎", "SA 破壞力 +10%"),
    atk("熔解", "敵方防禦貫穿率 +5%", { penetration: 5 }),
    atk("屠殺", "敵方附加傷害（一般）+5%"),
    atk("獨輪", "敵方附加傷害（BOSS／中級）+5%", { bDmg: 5 }),
    atk("突擊", "攻擊力 +36%", { atkPct: 36 }),
    atk("攻擊者", "攻擊力 +405", { atkFlat: 405 }),
    atk("碎片", "攻擊失敗時傷害率 +20%"),
    atk("燃燒", "命中時 3% 機率 3 秒內攻擊力 +24%", { atkPct: 24 }),
    atk("過熱", "命中時 1% 機率 5 秒內攻擊力 +45%", { atkPct: 45 }),
    atk("刺穿", "暴擊時 5% 機率 3 秒內貫穿 +6%", { penetration: 6 }),
    atk("滲透", "暴擊時 3% 機率 5 秒內貫穿 +10%", { penetration: 10 }),
    atk("黃蜂", "敵方附加傷害（空中）+20%"),
    atk("踐踏", "敵方附加傷害（倒地）+20%"),
  ],
  def: [
    def("盔甲", "防禦力 +54%"),
    def("受傷", "暴擊減傷 +6%"),
    def("模糊", "迴避度 +52"),
    def("幽靈", "迴避時 5 秒內傷害減少 5%"),
    def("巨人", "傷害減少（普通）+7%"),
    def("鸚螺", "傷害減少（BOSS／中級）+5%"),
    def("麻雀", "空中命中時 5 秒內傷害減少 7%"),
    def("地殼", "落地受傷時 5 秒內傷害減少 7%"),
    def("幻象", "受擊 15% 機率 3 秒內迴避度 +270"),
    def("幻影", "迴避時 10% 機率 10 秒內攻擊失敗傷害 +30%"),
    def("巨魔", "受暴擊 50% 機率恢復 2500 HP"),
    def("生命", "最大 HP +12%"),
    def("活力", "最大耐力 +8"),
    def("屏障", "傷害減少 +5%"),
    def("石像", "HP<50% 受擊 10% 機率 5 秒內防禦力 +50%"),
  ],
  fn: [
    fn("吸血", "擊殺：HP 恢復 +600"),
    fn("迅猛", "命中 5% 機率 5 秒內 SA 破壞力 +25%"),
    fn("行軍", "城鎮移動速度 +6%"),
    fn("鋼鐵", "受 BOSS 攻擊 10% 機率 5 秒內傷害減免 +10%"),
    fn("搖擺", "迴避後下一擊攻擊力 +70%", { atkPct: 70 }),
    fn("救濟", "迴避 10% 機率恢復 1500 HP"),
    fn("吸收", "命中 2% 機率恢復 10 耐力"),
    fn("迅速", "戰鬥區移動速度 +5%"),
    fn("硬度", "受擊 15% 機率 5 秒內防禦力 +70%"),
    fn("藐視", "受擊 8% 機率 10 秒內暴擊抵抗 +12"),
    fn("固執", "受擊 20% 機率 12 秒霸體"),
    fn("刺蝟", "受擊 20% 機率 5 秒內移動速度 +12%"),
    fn("喜悅", "迴避技能 15% 機率恢復 5% HP"),
    fn("行者", "衝刺 15% 機率 5 秒內移動速度 +7%"),
    fn("啟蒙", "技能 2% 機率冷卻 -10%"),
  ],
};
const SD_GB: CatPools = {
  atk: [
    atk("鷹眼", "命中度 +42"),
    atk("致命", "暴擊傷害值 +560", { critDmg: 560 }),
    atk("破碎", "SA 破壞力 +8%"),
    atk("熔解", "敵方防禦貫穿率 +4%", { penetration: 4 }),
    atk("屠殺", "敵方附加傷害（一般）+2%"),
    atk("獨輪", "敵方附加傷害（BOSS／中級）+2%", { bDmg: 2 }),
    atk("突擊", "攻擊力 +18%", { atkPct: 18 }),
    atk("攻擊者", "攻擊力 +315", { atkFlat: 315 }),
    atk("碎片", "攻擊失敗時傷害率 +16%"),
    atk("燃燒", "命中時 3% 機率 3 秒內攻擊力 +21%", { atkPct: 21 }),
    atk("過熱", "命中時 1% 機率 5 秒內攻擊力 +42%", { atkPct: 42 }),
    atk("刺穿", "暴擊時 5% 機率 3 秒內貫穿 +5%", { penetration: 5 }),
    atk("滲透", "暴擊時 3% 機率 5 秒內貫穿 +9%", { penetration: 9 }),
    atk("黃蜂", "敵方附加傷害（空中）+16%"),
    atk("踐踏", "敵方附加傷害（倒地）+16%"),
  ],
  def: [
    def("盔甲", "防禦力 +45%"),
    def("受傷", "暴擊減傷 +4%"),
    def("模糊", "迴避度 +42"),
    def("幽靈", "迴避時 5 秒內傷害減少 4%"),
    def("巨人", "傷害減少（普通）+5%"),
    def("鸚螺", "傷害減少（BOSS／中級）+4%"),
    def("麻雀", "空中命中時 5 秒內傷害減少 5%"),
    def("地殼", "落地受傷時 5 秒內傷害減少 5%"),
    def("幻象", "受擊 15% 機率 3 秒內迴避度 +240"),
    def("幻影", "迴避時 10% 機率 10 秒內攻擊失敗傷害 +27%"),
    def("巨魔", "受暴擊 50% 機率恢復 2000 HP"),
    def("生命", "最大 HP +10%"),
    def("活力", "最大耐力 +6"),
    def("屏障", "傷害減少 +2%"),
    def("石像", "HP<50% 受擊 10% 機率 5 秒內防禦力 +37%"),
  ],
  fn: [
    fn("吸血", "擊殺：HP 恢復 +480"),
    fn("迅猛", "命中 5% 機率 5 秒內 SA 破壞力 +23%"),
    fn("行軍", "城鎮移動速度 +5%"),
    fn("鋼鐵", "受 BOSS 攻擊 10% 機率 5 秒內傷害減免 +9%"),
    fn("搖擺", "迴避後下一擊攻擊力 +60%", { atkPct: 60 }),
    fn("救濟", "迴避 10% 機率恢復 1350 HP"),
    fn("吸收", "命中 2% 機率恢復 9 耐力"),
    fn("迅速", "戰鬥區移動速度 +4%"),
    fn("硬度", "受擊 15% 機率 5 秒內防禦力 +63%"),
    fn("藐視", "受擊 8% 機率 10 秒內暴擊抵抗 +10"),
    fn("固執", "受擊 20% 機率 10 秒霸體"),
    fn("刺蝟", "受擊 20% 機率 5 秒內移動速度 +9%"),
    fn("喜悅", "迴避技能 10% 機率恢復 3% HP"),
    fn("行者", "衝刺 15% 機率 5 秒內移動速度 +6%"),
    fn("啟蒙", "技能 2% 機率冷卻 -5%"),
  ],
};

/* ── BSK：完整勳章（攻擊／防禦／功能，含說明）；來源〈BSK 勳章〉。理論最大值：條件式
   自我增益（機率／持續觸發）若對應傷害數值，亦以全額計入 stats。 ── */
const BSK_TB: CatPools = {
  atk: [
    atk("鷹眼", "命中度 +52"),
    atk("飛行", "敵方附加傷害（空中）+20%"),
    atk("致命", "暴擊傷害值 +700", { critDmg: 700 }),
    atk("阻礙", "敵方附加傷害（倒地）+20%"),
    atk("破碎", "SA 破壞力 +10%"),
    atk("熔解", "敵方防禦貫穿率 +5%", { penetration: 5 }),
    atk("攻擊", "攻擊力 +216", { atkFlat: 216 }),
    atk("碎片", "攻擊失敗時傷害率 +20%"),
    atk("灰熊", "攻擊力 +48%（防禦力 -5%）", { atkPct: 48 }),
    atk("瘋狂", "攻擊力 +38%（迴避度 -30）", { atkPct: 38 }),
    atk("捨身", "攻擊力 +38%（最大HP -5%）", { atkPct: 38 }),
    atk("搏擊", "命中度 +90（防禦力 -5%）"),
    atk("野豬", "命中度 +90（迴避度 -30）"),
    atk("老虎", "命中度 +90（最大HP -5%）"),
    atk("黑蛇", "SA 破壞力 +9%（防禦力 -5%）"),
    atk("海怪", "SA 破壞力 +9%（迴避度 -30）"),
    atk("麋鹿", "SA 破壞力 +9%（最大HP -5%）"),
  ],
  def: [
    def("盔甲", "防禦力 +25%"),
    def("模糊", "迴避度 +42"),
    def("幽靈", "迴避時 5 秒內傷害減少 9%"),
    def("巨人", "傷害減少（普通）+9%"),
    def("鸚螺", "傷害減少（BOSS／中級）+5%"),
    def("麻雀", "空中命中時 5 秒內傷害減少 10%"),
    def("地殼", "落地受傷時 5 秒內傷害減少 10%"),
    def("狂暴", "受擊 30% 機率 5 秒內攻擊力 +1080", { atkFlat: 1080 }),
    def("恐懼", "受擊 30% 機率 5 秒內命中度 +350"),
    def("欺瞞", "受擊 30% 機率 5 秒內暴擊傷害 +1500", { critDmg: 1500 }),
    def("發狂", "受擊 30% 機率 5 秒內打偏傷害 +50%"),
    def("死神", "受擊 30% 機率 5 秒內 SA 破壞力 +50%"),
    def("激怒", "迴避 30% 機率 5 秒內攻擊力 +1200", { atkFlat: 1200 }),
    def("鐵桿", "迴避 30% 機率 5 秒內命中度 +20"),
    def("犀牛", "迴避 30% 機率 5 秒內暴擊傷害 +2400", { critDmg: 2400 }),
    def("憤怒", "迴避 30% 機率 5 秒內打偏傷害 +50%"),
    def("小鬼", "迴避 30% 機率 5 秒內 SA 破壞力 +21%"),
  ],
  fn: [
    fn("固執", "受擊 20% 機率 12 秒霸體"),
    fn("迅猛", "命中 5% 機率 5 秒內 SA 破壞力 +21%"),
    fn("行軍", "城鎮移動速度 +6%"),
    fn("鋼鐵", "受 BOSS 攻擊 10% 機率 5 秒內傷害減免 +8%"),
    fn("搖擺", "迴避後下一擊攻擊力 +56%", { atkPct: 56 }),
    fn("救濟", "迴避 10% 機率恢復 2500 HP"),
    fn("窺視", "受擊 8% 機率 10 秒內暴擊抵抗 +12"),
    fn("迅速", "戰鬥區移動速度 +5%"),
    fn("發熱", "技能 10% 機率 5 秒內攻擊力 +1350", { atkFlat: 1350 }),
    fn("恢復", "技能 10% 機率 5 秒內命中度 +350"),
    fn("沉重", "技能 3% 機率 5 秒內暴擊傷害 +3000", { critDmg: 3000 }),
    fn("劍聖", "衝刺 30% 機率 5 秒內攻擊力 +450", { atkFlat: 450 }),
    fn("餅乾", "衝刺 10% 機率 5 秒內 SA 破壞力 +10%"),
    fn("充電", "衝刺 10% 機率 5 秒內穿甲 +10%", { penetration: 10 }),
    fn("狂亂", "擊殺 5 秒內攻擊力 +1225", { atkFlat: 1225 }),
    fn("狂人", "擊殺 5 秒內 SA 破壞力 +16%"),
    fn("感覺", "擊殺 5 秒內穿甲 +16%", { penetration: 16 }),
  ],
};
const BSK_GB: CatPools = {
  atk: [
    atk("鷹眼", "命中度 +42"),
    atk("飛行", "敵方附加傷害（空中）+16%"),
    atk("致命", "暴擊傷害值 +560", { critDmg: 560 }),
    atk("阻礙", "敵方附加傷害（倒地）+16%"),
    atk("破碎", "SA 破壞力 +8%"),
    atk("熔解", "敵方防禦貫穿率 +4%", { penetration: 4 }),
    atk("攻擊", "攻擊力 +168", { atkFlat: 168 }),
    atk("碎片", "攻擊失敗時傷害率 +16%"),
    atk("灰熊", "攻擊力 +42%（防禦力 -5%）", { atkPct: 42 }),
    atk("瘋狂", "攻擊力 +33%（迴避度 -30）", { atkPct: 33 }),
    atk("捨身", "攻擊力 +33%（最大HP -5%）", { atkPct: 33 }),
    atk("搏擊", "命中度 +80（防禦力 -5%）"),
    atk("野豬", "命中度 +80（迴避度 -30）"),
    atk("老虎", "命中度 +80（最大HP -5%）"),
    atk("黑蛇", "SA 破壞力 +8%（防禦力 -5%）"),
    atk("海怪", "SA 破壞力 +8%（迴避度 -30）"),
    atk("麋鹿", "SA 破壞力 +8%（最大HP -5%）"),
  ],
  def: [
    def("盔甲", "防禦力 +21%"),
    def("模糊", "迴避度 +33"),
    def("幽靈", "迴避時 5 秒內傷害減少 7%"),
    def("巨人", "傷害減少（普通）+7%"),
    def("鸚螺", "傷害減少（BOSS／中級）+4%"),
    def("麻雀", "空中命中時 5 秒內傷害減少 8%"),
    def("地殼", "落地受傷時 5 秒內傷害減少 8%"),
    def("狂暴", "受擊 30% 機率 5 秒內攻擊力 +840", { atkFlat: 840 }),
    def("恐懼", "受擊 30% 機率 5 秒內命中度 +280"),
    def("欺瞞", "受擊 30% 機率 5 秒內暴擊傷害 +1200", { critDmg: 1200 }),
    def("發狂", "受擊 30% 機率 5 秒內打偏傷害 +40%"),
    def("死神", "受擊 30% 機率 5 秒內 SA 破壞力 +40%"),
    def("激怒", "迴避 30% 機率 5 秒內攻擊力 +750", { atkFlat: 750 }),
    def("鐵桿", "迴避 30% 機率 5 秒內命中度 +16"),
    def("犀牛", "迴避 30% 機率 5 秒內暴擊傷害 +1680", { critDmg: 1680 }),
    def("憤怒", "迴避 30% 機率 5 秒內打偏傷害 +42%"),
    def("小鬼", "迴避 30% 機率 5 秒內 SA 破壞力 +16%"),
  ],
  fn: [
    fn("固執", "受擊 20% 機率 10 秒霸體"),
    fn("行軍", "城鎮移動速度 +5%"),
    fn("鋼鐵", "受 BOSS 攻擊 10% 機率 5 秒內傷害減免 +7%"),
    fn("搖擺", "迴避後下一擊攻擊力 +48%", { atkPct: 48 }),
    fn("救濟", "迴避 10% 機率恢復 2250 HP"),
    fn("窺視", "受擊 8% 機率 10 秒內暴擊抵抗 +10"),
    fn("迅速", "戰鬥區移動速度 +4%"),
    fn("發熱", "技能 10% 機率 5 秒內攻擊力 +1050", { atkFlat: 1050 }),
    fn("恢復", "技能 10% 機率 5 秒內命中度 +280"),
    fn("沉重", "技能 3% 機率 5 秒內暴擊傷害 +2400", { critDmg: 2400 }),
    fn("劍聖", "衝刺 30% 機率 5 秒內攻擊力 +350", { atkFlat: 350 }),
    fn("餅乾", "衝刺 10% 機率 5 秒內 SA 破壞力 +8%"),
    fn("充電", "衝刺 10% 機率 5 秒內穿甲 +8%", { penetration: 8 }),
    fn("狂亂", "擊殺 5 秒內攻擊力 +700", { atkFlat: 700 }),
    fn("狂人", "擊殺 5 秒內 SA 破壞力 +12%"),
    fn("感覺", "擊殺 5 秒內穿甲 +12%", { penetration: 12 }),
  ],
};

/* ── FOT：攻擊／功能含說明＋理論最大值；防禦型全為非傷害（防禦／HP／體力），故僅列名稱
   （GB 防禦表於原文不完整，兩階共用同一份名單以供湊套裝）。來源〈FOT 勳章〉。 ── */
const FOT_DEF_NAMES = ["戰壕", "危城", "防禦", "地圖", "堡壘", "停留", "堅固的", "摩擦", "穩固", "休戰"];
const FOT_TB: CatPools = {
  atk: [
    atk("燃料庫", "敵方防禦貫穿率 +5%（迴避度 -45）", { penetration: 5 }),
    atk("投石器", "敵方防禦貫穿率 +5%（命中度 -45）", { penetration: 5 }),
    atk("發射器", "暴擊傷害值 +720（命中度 -25）", { critDmg: 720 }),
    atk("閃電戰", "暴擊傷害值 +720（迴避度 -38）", { critDmg: 720 }),
    atk("加農", "攻擊力 +600（命中度 -25）", { atkFlat: 600 }),
    atk("佔領", "攻擊力 +600（迴避度 -38）", { atkFlat: 600 }),
    atk("支配", "暴擊率 +5%（迴避度 -38）", { critRate: 5 }),
    atk("游擊隊", "體力≥70% 攻擊成功時 3 秒內暴擊傷害 +840", { critDmg: 840 }),
    atk("勇氣", "體力<30% 攻擊成功時 3 秒內暴擊傷害 +1260", { critDmg: 1260 }),
    atk("大將", "命中 15% 機率體力恢復 320"),
  ],
  def: names("def", FOT_DEF_NAMES),
  fn: [
    fn("掃蕩", "衝刺 10% 機率 5 秒內防禦度 +400"),
    fn("戰術", "擊殺 5 秒內攻擊力 +1200", { atkFlat: 1200 }),
    fn("防護", "擊殺 5 秒內防禦度 +850"),
    fn("撤退", "迴避技能 10% 機率恢復 15% HP"),
    fn("疏散", "擊殺 5 秒內傷害減少 +12%"),
    fn("狙擊", "技能 10% 機率靈魂值恢復 15%"),
    fn("打擊", "受擊 5% 機率 10 秒內防禦度 +150"),
    fn("偵察", "命中 10% 機率 5 秒內攻擊力 +400", { atkFlat: 400 }),
    fn("對策", "體力 20% 受擊 10% 機率 1.5 秒無敵"),
    fn("保護", "技能 10% 機率 5 秒內防禦度 +800"),
  ],
};
const FOT_GB: CatPools = {
  atk: [
    atk("燃料庫", "敵方防禦貫穿率 +4%（迴避度 -45）", { penetration: 4 }),
    atk("投石器", "敵方防禦貫穿率 +4%（命中度 -45）", { penetration: 4 }),
    atk("發射器", "暴擊傷害值 +480（命中度 -25）", { critDmg: 480 }),
    atk("閃電戰", "暴擊傷害值 +480（迴避度 -38）", { critDmg: 480 }),
    atk("加農", "攻擊力 +420（命中度 -25）", { atkFlat: 420 }),
    atk("佔領", "攻擊力 +420（迴避度 -38）", { atkFlat: 420 }),
    atk("支配", "暴擊率 +4%（迴避度 -38）", { critRate: 4 }),
    atk("游擊隊", "體力≥70% 攻擊成功時 3 秒內暴擊傷害 +560", { critDmg: 560 }),
    atk("勇氣", "體力<30% 攻擊成功時 3 秒內暴擊傷害 +810", { critDmg: 810 }),
    atk("大將", "命中 15% 機率體力恢復 220"),
  ],
  def: names("def", FOT_DEF_NAMES),
  fn: [
    fn("掃蕩", "衝刺 10% 機率 5 秒內防禦度 +300"),
    fn("戰術", "擊殺 5 秒內攻擊力 +1000", { atkFlat: 1000 }),
    fn("防護", "擊殺 5 秒內防禦度 +575"),
    fn("撤退", "迴避技能 10% 機率恢復 11% HP"),
    fn("疏散", "擊殺 5 秒內傷害減少 +9%"),
    fn("狙擊", "技能 10% 機率靈魂值恢復 12%"),
    fn("打擊", "受擊 5% 機率 10 秒內防禦度 +100"),
    fn("偵察", "命中 10% 機率 5 秒內攻擊力 +300", { atkFlat: 300 }),
    fn("對策", "體力 20% 受擊 10% 機率 1.25 秒無敵"),
    fn("保護", "技能 10% 機率 5 秒內防禦度 +600"),
  ],
};

/* ── SIN：完整勳章（攻擊／防禦／功能，含說明＋理論最大值）。防禦／功能多為暴擊系條件
   增益，計入暴擊率／暴擊傷害。來源〈SIN 勳章〉。 ── */
const SIN_TB: CatPools = {
  atk: [
    atk("猝死", "暴擊率 +5%", { critRate: 5 }),
    atk("暗殺", "暴擊率 +6%（迴避度 -30）", { critRate: 6 }),
    atk("刺激者", "暴擊率 +6%（最大HP -5%）", { critRate: 6 }),
    atk("擦傷", "攻擊速度 +4%、敵方防禦貫穿率 +2%", { penetration: 2 }),
    atk("颶風", "攻擊速度 +4%、敵方附加傷害（BOSS／中級）+2%", { bDmg: 2 }),
    atk("根除", "暴擊傷害值 +980（最大HP -5%）", { critDmg: 980 }),
    atk("魯莽", "敵方防禦貫穿率 +5%（防禦力 -5%）", { penetration: 5 }),
    atk("清除", "暴擊傷害值 +756", { critDmg: 756 }),
    atk("驅動", "命中暴擊 10% 機率 2 秒內攻擊速度 +50%"),
    atk("酸性的", "命中暴擊 10% 機率 2 秒內暴擊傷害 +1620", { critDmg: 1620 }),
  ],
  def: [
    def("躲藏", "迴避度 +130"),
    def("油漆", "受暴擊 50% 機率 2 秒內攻擊速度 +12%"),
    def("分身", "受暴擊 50% 機率 2 秒內暴擊傷害 +1560", { critDmg: 1560 }),
    def("煙霧", "迴避技能 10% 機率 5 秒內暴擊率 +12%", { critRate: 12 }),
    def("逃避", "迴避技能 10% 機率 5 秒內暴擊傷害 +1723", { critDmg: 1723 }),
    def("預防", "暴擊減傷 +10%"),
    def("流動", "受擊 30% 機率 1.5 秒內攻擊速度 +70%"),
    def("打斷", "受擊 40% 機率 3 秒內迴避度 +180"),
    def("影子步伐", "迴避 30% 機率 2 秒內暴擊率 +14%", { critRate: 14 }),
    def("後退步伐", "受擊 50% 機率 3 秒內暴擊傷害 +1930", { critDmg: 1930 }),
  ],
  fn: [
    fn("飛鼠裝", "戰鬥區移動速度 +7%"),
    fn("貓眼", "技能 5% 機率 5 秒內暴擊傷害 +2200", { critDmg: 2200 }),
    fn("鷹眼", "衝刺 20% 機率 3 秒內暴擊傷害 +1760", { critDmg: 1760 }),
    fn("追捕", "衝刺 30% 機率 5 秒內暴擊率 +8%", { critRate: 8 }),
    fn("血腥斗篷", "技能 5% 機率 5 秒內暴擊率 +8%", { critRate: 8 }),
    fn("弱點標記", "耐力≥50% 受擊 5 秒內暴擊傷害 +550", { critDmg: 550 }),
    fn("嗜血", "耐力≥50% 受擊恢復 140 HP"),
    fn("斷頭台", "消耗道具 20% 機率 5 秒內暴擊傷害 +1250", { critDmg: 1250 }),
    fn("瘋狂", "消耗道具 20% 機率 5 秒內攻擊力 +936", { atkFlat: 936 }),
    fn("技術", "命中暴擊 10% 機率 5 秒內攻擊力 +760", { atkFlat: 760 }),
  ],
};
const SIN_GB: CatPools = {
  atk: [
    atk("猝死", "暴擊率 +4%", { critRate: 4 }),
    atk("暗殺", "暴擊率 +4%（迴避度 -30）", { critRate: 4 }),
    atk("刺激者", "暴擊率 +4%（最大HP -5%）", { critRate: 4 }),
    atk("擦傷", "攻擊速度 +3%、敵方防禦貫穿率 +1%", { penetration: 1 }),
    atk("颶風", "攻擊速度 +3%、敵方附加傷害（BOSS／中級）+1%", { bDmg: 1 }),
    atk("根除", "暴擊傷害值 +560（最大HP -5%）", { critDmg: 560 }),
    atk("魯莽", "敵方防禦貫穿率 +4%（防禦力 -5%）", { penetration: 4 }),
    atk("清除", "暴擊傷害值 +448", { critDmg: 448 }),
    atk("驅動", "命中暴擊 10% 機率 2 秒內攻擊速度 +4%"),
    atk("酸性的", "命中暴擊 10% 機率 2 秒內暴擊傷害 +1134", { critDmg: 1134 }),
  ],
  def: [
    def("躲藏", "迴避度 +91"),
    def("油漆", "受暴擊 50% 機率 2 秒內攻擊速度 +9%"),
    def("分身", "受暴擊 50% 機率 2 秒內暴擊傷害 +960", { critDmg: 960 }),
    def("煙霧", "迴避技能 10% 機率 5 秒內暴擊率 +9%", { critRate: 9 }),
    def("逃避", "迴避技能 10% 機率 5 秒內暴擊傷害 +1060", { critDmg: 1060 }),
    def("預防", "暴擊減傷 +8%"),
    def("流動", "受擊 30% 機率 1.5 秒內攻擊速度 +40%"),
    def("打斷", "受擊 40% 機率 3 秒內迴避度 +126"),
    def("影子步伐", "迴避 30% 機率 2 秒內暴擊率 +10%", { critRate: 10 }),
    def("後退步伐", "受擊 50% 機率 3 秒內暴擊傷害 +1351", { critDmg: 1351 }),
  ],
  fn: [
    fn("飛鼠裝", "戰鬥區移動速度 +5%"),
    fn("貓眼", "技能 5% 機率 5 秒內暴擊傷害 +1600", { critDmg: 1600 }),
    fn("鷹眼", "衝刺 20% 機率 3 秒內暴擊傷害 +1232", { critDmg: 1232 }),
    fn("追捕", "衝刺 30% 機率 5 秒內暴擊率 +6%", { critRate: 6 }),
    fn("血腥斗篷", "技能 5% 機率 5 秒內暴擊率 +6%", { critRate: 6 }),
    fn("弱點標記", "耐力≥50% 受擊 5 秒內暴擊傷害 +385", { critDmg: 385 }),
    fn("嗜血", "耐力≥50% 受擊恢復 100 HP"),
    fn("斷頭台", "消耗道具 20% 機率 5 秒內暴擊傷害 +875", { critDmg: 875 }),
    fn("瘋狂", "消耗道具 20% 機率 5 秒內攻擊力 +655", { atkFlat: 655 }),
    fn("技術", "命中暴擊 10% 機率 5 秒內攻擊力 +532", { atkFlat: 532 }),
  ],
};

/** Every medal, keyed by 型號 → 稀有度 → 類別. */
const MEDALS: Record<MedalType, Record<MedalRarity, CatPools>> = {
  SD: { TB: SD_TB, GB: SD_GB },
  BSK: { TB: BSK_TB, GB: BSK_GB },
  FOT: { TB: FOT_TB, GB: FOT_GB },
  SIN: { TB: SIN_TB, GB: SIN_GB },
};

/**
 * Per-part 套裝效果 (set bonus), damage-only slice of 勳章目錄〈勳章套裝組合效果〉.
 * Triggers when an armor piece's 3 slots all share 型號 ＋ 稀有度. {} = no damage stat.
 */
const SET_BONUS: Record<MedalPart, Record<MedalType, Record<MedalRarity, Stats>>> = {
  head: {
    SD: { GB: { atkPct: 10, penetration: 3 }, TB: { atkPct: 15, penetration: 5 } },
    BSK: { GB: { atkPct: 20 }, TB: { atkPct: 25 } },
    FOT: {
      GB: { atkFlat: 560, critDmg: 700, critRate: 3 },
      TB: { atkFlat: 800, critDmg: 1000, critRate: 3 },
    },
    SIN: { GB: { critRate: 4 }, TB: { critRate: 5 } },
  },
  top: {
    SD: { GB: { atkFlat: 700 }, TB: { atkFlat: 1000 } },
    BSK: { GB: { critRate: 4 }, TB: { critRate: 5 } },
    FOT: { GB: { atkFlat: 1750 }, TB: { atkFlat: 2500 } },
    SIN: { GB: {}, TB: {} },
  },
  hands: {
    SD: { GB: {}, TB: {} },
    BSK: { GB: {}, TB: {} },
    FOT: { GB: { critDmg: 560 }, TB: { critDmg: 800 } },
    SIN: { GB: { critRate: 2 }, TB: { critRate: 3 } },
  },
  legs: {
    SD: { GB: {}, TB: {} },
    BSK: { GB: {}, TB: {} }, // 霸體破壞力 — no damage-formula StatKey
    FOT: { GB: {}, TB: {} },
    SIN: { GB: { critDmg: 1150 }, TB: { critDmg: 1350 } },
  },
  shoes: {
    SD: { GB: { critDmg: 900, critRate: 1 }, TB: { critDmg: 1000, critRate: 2 } },
    BSK: { GB: { critDmg: 1350 }, TB: { critDmg: 1700 } },
    FOT: { GB: { atkFlat: 350 }, TB: { atkFlat: 500 } },
    SIN: { GB: { critRate: 2 }, TB: { critRate: 3 } },
  },
};

/** Medal pool for a slot, gated by its fixed category (slot 0 攻擊 / 1 防禦 / 2 功能). */
export function medalsForSlot(
  type: string | null,
  rarity: string | null,
  slotIndex: number,
): MedalDef[] {
  if (!type || !rarity) return [];
  const cat = SLOT_CATEGORIES[slotIndex];
  return MEDALS[type as MedalType]?.[rarity as MedalRarity]?.[cat] ?? [];
}

/** Set bonus for a part's (型號, 稀有度) — {} if not chosen or no damage stat. */
export function setBonusFor(part: string, type: string | null, rarity: string | null): Stats {
  if (!type || !rarity) return {};
  return SET_BONUS[part as MedalPart]?.[type as MedalType]?.[rarity as MedalRarity] ?? {};
}

type Picks = Record<string, string | null>;

/* picks.medal keys: each part has 3 slots; EACH slot picks its own 稀有度／型號／勳章
   (slots need not match — "some part no need to be in set"). */
export const slotTierKey = (part: string, i: number) => `${part}-s${i}-tier`;
export const slotTypeKey = (part: string, i: number) => `${part}-s${i}-type`;
export const slotMedalKey = (part: string, i: number) => `${part}-s${i}-medal`;

export const MEDAL_PICK_KEYS: string[] = MEDAL_PARTS.flatMap((p) =>
  Array.from({ length: MEDAL_SLOTS }, (_, i) => [
    slotTierKey(p.id, i),
    slotTypeKey(p.id, i),
    slotMedalKey(p.id, i),
  ]).flat(),
);

export interface MedalSlotPick {
  tier: string | null;
  type: string | null;
  medalId: string | null;
}
export interface MedalPartState {
  slots: MedalSlotPick[];
  /** All 3 slots share the same 稀有度＋型號 (both non-null). */
  sameSet: boolean;
  /** Every slot has tier+type+medal chosen. */
  allFilled: boolean;
  /** Set bonus is live (sameSet AND allFilled). */
  setActive: boolean;
  /** Preview/active set bonus for the shared 型號＋稀有度 ({} when mixed). */
  bonus: Stats;
}

/** Resolve one part's 3 slots and whether its set bonus triggers. */
export function medalPartState(picks: Picks | undefined, partId: string): MedalPartState {
  const slots: MedalSlotPick[] = Array.from({ length: MEDAL_SLOTS }, (_, i) => ({
    tier: picks?.[slotTierKey(partId, i)] ?? null,
    type: picks?.[slotTypeKey(partId, i)] ?? null,
    medalId: picks?.[slotMedalKey(partId, i)] ?? null,
  }));
  const t0 = slots[0].tier;
  const m0 = slots[0].type;
  const sameSet = !!t0 && !!m0 && slots.every((s) => s.tier === t0 && s.type === m0);
  const allFilled = slots.every((s) => !!s.tier && !!s.type && !!s.medalId);
  return {
    slots,
    sameSet,
    allFilled,
    setActive: sameSet && allFilled,
    bonus: sameSet ? setBonusFor(partId, m0, t0) : {},
  };
}

/** Total damage stats from medals: every slotted medal + each part's live set bonus. */
export function computeMedalStats(picks: Picks | undefined): Stats {
  const out: Stats = {};
  if (!picks) return out;
  const add = (s: Stats) => {
    for (const k of STAT_KEYS) if (s[k]) out[k] = (out[k] ?? 0) + s[k]!;
  };
  for (const part of MEDAL_PARTS) {
    const st = medalPartState(picks, part.id);
    let valid = 0;
    st.slots.forEach((s, i) => {
      if (!s.tier || !s.type || !s.medalId) return;
      const medal = medalsForSlot(s.type, s.tier, i).find((mm) => mm.id === s.medalId);
      if (medal) {
        add(medal.stats);
        valid += 1;
      }
    });
    if (valid >= MEDAL_SLOTS && st.sameSet) add(st.bonus);
  }
  return out;
}
