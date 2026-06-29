"use client";

import { useMemo, useState } from "react";

/**
 * Damage model (placeholder — verify against in-game numbers).
 *
 *   base       = ATK × 技能倍率%
 *   amplified  = base × (1 + (增傷% + 屬性傷害%) / 100)
 *   mitigated  = amplified × (1 − 敵方減傷% / 100)
 *
 *   一般傷害   = mitigated
 *   暴擊傷害   = mitigated × (1 + 暴擊傷害% / 100)
 *   期望單擊   = mitigated × (1 + 暴擊率/100 × 暴擊傷害%/100)
 *   總傷害     = 期望單擊 × 技能段數
 *
 * Tune the formula in computeDamage() once the real coefficients are known.
 */

interface Field {
  key: string;
  label: string;
  en: string;
  /** Hard cap (e.g. percentages capped at 100). */
  max?: number;
  /** Step for the number input. */
  step?: number;
  hint?: string;
}

interface Group {
  title: string;
  en: string;
  accent: "cyan" | "magenta" | "gold";
  fields: Field[];
}

const GROUPS: Group[] = [
  {
    title: "角色屬性",
    en: "Character Stats",
    accent: "cyan",
    fields: [
      { key: "atk", label: "攻擊力", en: "ATK", step: 100 },
      { key: "dmgBonus", label: "傷害增加", en: "Damage Bonus %", step: 1 },
      { key: "attrDmg", label: "屬性傷害", en: "Attribute Damage %", step: 1 },
      { key: "critRate", label: "暴擊率", en: "Crit Rate %", max: 100, step: 1 },
      { key: "critDmg", label: "暴擊傷害", en: "Crit Damage %", step: 1 },
    ],
  },
  {
    title: "技能",
    en: "Skill",
    accent: "magenta",
    fields: [
      { key: "skillPct", label: "技能倍率", en: "Skill Multiplier %", step: 5 },
      { key: "hits", label: "技能段數", en: "Hit Count", step: 1, hint: "整個技能命中的段數" },
    ],
  },
  {
    title: "敵方",
    en: "Enemy",
    accent: "gold",
    fields: [
      {
        key: "reduction",
        label: "減傷率",
        en: "Damage Reduction %",
        max: 100,
        step: 1,
        hint: "敵方防禦造成的減傷百分比",
      },
    ],
  },
];

type Values = Record<string, number>;

const DEFAULTS: Values = {
  atk: 50000,
  dmgBonus: 30,
  attrDmg: 20,
  critRate: 60,
  critDmg: 150,
  skillPct: 400,
  hits: 1,
  reduction: 0,
};

const ACCENT: Record<Group["accent"], string> = {
  cyan: "text-cyan",
  magenta: "text-magenta",
  gold: "text-gold",
};

interface Result {
  normal: number;
  crit: number;
  expected: number;
  total: number;
}

function computeDamage(v: Values): Result {
  const base = v.atk * (v.skillPct / 100);
  const amplified = base * (1 + (v.dmgBonus + v.attrDmg) / 100);
  const mitigated = amplified * (1 - clamp(v.reduction, 0, 100) / 100);

  const critRate = clamp(v.critRate, 0, 100) / 100;
  const normal = mitigated;
  const crit = mitigated * (1 + v.critDmg / 100);
  const expected = mitigated * (1 + critRate * (v.critDmg / 100));
  const total = expected * Math.max(1, Math.floor(v.hits) || 1);

  return { normal, crit, expected, total };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

const FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
function fmt(n: number): string {
  return Number.isFinite(n) ? FMT.format(Math.round(n)) : "—";
}

export default function DamageCalculator() {
  const [values, setValues] = useState<Values>(DEFAULTS);

  const result = useMemo(() => computeDamage(values), [values]);

  const setField = (field: Field, raw: string) => {
    const parsed = raw === "" ? 0 : Number(raw);
    const next = Number.isNaN(parsed) ? 0 : parsed;
    const capped = field.max != null ? clamp(next, 0, field.max) : Math.max(0, next);
    setValues((prev) => ({ ...prev, [field.key]: capped }));
  };

  const reset = () => setValues(DEFAULTS);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* ---- inputs ---- */}
      <div className="flex flex-col gap-5">
        {GROUPS.map((group) => (
          <section key={group.title} className="panel panel-static p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className={`font-display text-lg font-bold tracking-wide ${ACCENT[group.accent]}`}>
                {group.title}
              </h2>
              <span className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-ink-faint">
                {group.en}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <label key={field.key} className="flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{field.label}</span>
                    <span className="font-display text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      {field.en}
                    </span>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={field.max}
                    step={field.step ?? 1}
                    value={values[field.key]}
                    onChange={(e) => setField(field, e.target.value)}
                    className="calc-input"
                  />
                  {field.hint ? (
                    <span className="text-[0.72rem] leading-snug text-ink-faint">{field.hint}</span>
                  ) : null}
                </label>
              ))}
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={reset}
          className="self-start font-display text-xs font-semibold uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-cyan"
        >
          ↺ 重設預設值
        </button>
      </div>

      {/* ---- results ---- */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="panel p-6">
          <div className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-ink-faint">
            Total Damage
          </div>
          <div className="mt-1 font-display text-xs font-semibold tracking-[0.2em] text-ink-dim">
            總傷害
          </div>
          <div className="neon-text mt-2 font-display text-4xl font-bold tabular-nums sm:text-5xl">
            {fmt(result.total)}
          </div>
          <p className="mt-1 text-xs text-ink-faint">期望單擊 × 技能段數</p>

          <div className="mt-6 grid gap-3">
            <ResultRow label="一般傷害" en="Normal" value={result.normal} tone="ink" />
            <ResultRow label="暴擊傷害" en="Crit" value={result.crit} tone="magenta" />
            <ResultRow label="期望單擊" en="Expected" value={result.expected} tone="cyan" />
          </div>
        </div>

        <div className="callout callout--note mt-5">
          <div className="callout-title">
            <span className="callout-icon" aria-hidden="true" />
            計算公式
          </div>
          <div className="callout-body text-[0.82rem] leading-relaxed">
            <p>
              目前為通用估算模型：<br />
              基礎 = 攻擊力 × 技能倍率 → 套用增傷與屬性傷害 → 扣除敵方減傷。期望單擊已將暴擊率納入加權平均。
            </p>
            <p className="text-ink-faint">
              實際遊戲係數待校正，數值僅供相對比較參考。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  en,
  value,
  tone,
}: {
  label: string;
  en: string;
  value: number;
  tone: "ink" | "cyan" | "magenta";
}) {
  const color =
    tone === "cyan" ? "text-cyan" : tone === "magenta" ? "text-magenta" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5 last:border-0">
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink-dim">{label}</span>
        <span className="font-display text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          {en}
        </span>
      </span>
      <span className={`font-display text-xl font-bold tabular-nums ${color}`}>{fmt(value)}</span>
    </div>
  );
}
