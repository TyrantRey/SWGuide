"use client";

import type { ReactNode } from "react";
import { STAT_KEYS, STAT_META } from "./config";
import {
  CAT_LABEL,
  computeMedalStats,
  MEDAL_PARTS,
  MEDAL_RARITIES,
  MEDAL_TYPES,
  medalPartState,
  medalsForSlot,
  SLOT_CATEGORIES,
  slotMedalKey,
  slotTierKey,
  slotTypeKey,
} from "./medals";
import type { MedalDef, MedalSlotPick } from "./medals";
import type { StatKey } from "./types";

type Picks = Record<string, string | null>;

const fmtStat = (k: StatKey, v: number) =>
  `${STAT_META[k].label} +${v}${STAT_META[k].pct ? "%" : ""}`;
const medalDesc = (medal: MedalDef) =>
  medal.desc ??
  (STAT_KEYS.filter((k) => medal.stats[k])
    .map((k) => fmtStat(k, medal.stats[k]!))
    .join("、") ||
    "—");

/**
 * 勳章 tab. Each part has 3 slots and EACH slot is its own cascade:
 *   稀有度 (TB／GB) → 型號 (SD/SIN/BSK/FOT) → 勳章 (含說明).
 * Slots need not match; a part's 套裝效果 auto-triggers only when all 3 share the
 * same 稀有度＋型號. Aggregation lives in medals.ts/computeMedalStats.
 */
export default function MedalPanel({
  picks,
  onChange,
}: {
  picks: Picks;
  onChange: (next: Picks) => void;
}) {
  const setMedal = (key: string, val: string | null) => onChange({ ...picks, [key]: val });
  // Changing a slot's 稀有度/型號 changes its pool → reset that slot's medal.
  const setMeta = (key: string, val: string | null, medalKey: string) =>
    onChange({ ...picks, [key]: val, [medalKey]: null });

  const total = computeMedalStats(picks);
  const totalKeys = STAT_KEYS.filter((k) => total[k]);

  return (
    <div className="flex flex-col gap-4">
      {MEDAL_PARTS.map((part) => (
        <MedalPartCard key={part.id} part={part} picks={picks} onMeta={setMeta} onMedal={setMedal} />
      ))}

      {/* live contribution summary */}
      <div className="border-t border-line pt-3">
        <div className="mb-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-gold">
          勳章加成總計 · MEDAL TOTAL
        </div>
        {totalKeys.length ? (
          <div className="flex flex-wrap gap-1.5">
            {totalKeys.map((k) => (
              <span key={k} className="capsule capsule--accent text-[0.82rem]">
                {fmtStat(k, total[k]!)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[0.86rem] text-ink-dim">
            為各部位的 3 個欄位挑選稀有度、型號與勳章後，傷害數值會自動累計於此。
          </p>
        )}
      </div>
    </div>
  );
}

function MedalPartCard({
  part,
  picks,
  onMeta,
  onMedal,
}: {
  part: (typeof MEDAL_PARTS)[number];
  picks: Picks;
  onMeta: (key: string, val: string | null, medalKey: string) => void;
  onMedal: (key: string, val: string | null) => void;
}) {
  const st = medalPartState(picks, part.id);
  const setKeys = STAT_KEYS.filter((k) => st.bonus[k]);
  const filled = st.slots.filter((s) => s.tier && s.type && s.medalId).length;

  return (
    <div className="border border-line bg-surface/30">
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-gold/[0.06] px-3 py-2">
        <span className="text-base font-semibold text-gold">{part.label}</span>
        <span className="font-display text-[0.62rem] uppercase tracking-[0.2em] text-ink-faint">
          {part.en}
        </span>
        {st.setActive ? (
          <span className="ml-auto font-display text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-green">
            套裝啟用
          </span>
        ) : null}
      </div>

      {/* 3 independent slot cascades */}
      <div>
        {st.slots.map((slot, i) => (
          <SlotRow key={i} part={part.id} index={i} slot={slot} onMeta={onMeta} onMedal={onMedal} />
        ))}
      </div>

      {/* auto set effect */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        <span className="shrink-0 text-[0.82rem] font-medium text-gold">套裝效果</span>
        {!st.sameSet ? (
          <span className="text-[0.82rem] text-ink-dim">
            {st.slots.some((s) => s.tier || s.type || s.medalId)
              ? "未組套：3 顆需同稀有度＋同型號。"
              : "尚未配置勳章。"}
          </span>
        ) : setKeys.length === 0 ? (
          <span className="text-[0.82rem] text-ink-dim">此型號於該部位無傷害套裝數值。</span>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {setKeys.map((k) => (
                <span
                  key={k}
                  className={`capsule text-[0.8rem] ${st.setActive ? "capsule--accent" : "opacity-45"}`}
                >
                  {fmtStat(k, st.bonus[k]!)}
                </span>
              ))}
            </div>
            {!st.setActive ? (
              <span className="text-[0.8rem] text-ink-dim">需 3 顆同稀有度＋型號（已 {filled}/3）</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function SlotRow({
  part,
  index,
  slot,
  onMeta,
  onMedal,
}: {
  part: string;
  index: number;
  slot: MedalSlotPick;
  onMeta: (key: string, val: string | null, medalKey: string) => void;
  onMedal: (key: string, val: string | null) => void;
}) {
  const tierKey = slotTierKey(part, index);
  const typeKey = slotTypeKey(part, index);
  const medalKey = slotMedalKey(part, index);
  const ready = !!slot.tier && !!slot.type;
  const pool = medalsForSlot(slot.type, slot.tier, index);
  const medal = pool.find((mm) => mm.id === slot.medalId) ?? null;
  const medalKeys = medal ? STAT_KEYS.filter((k) => medal.stats[k]) : [];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2 last:border-b-0">
      <span className="w-14 shrink-0 font-display text-[0.76rem] font-bold uppercase tracking-wide text-cyan">
        {CAT_LABEL[SLOT_CATEGORIES[index]]}
      </span>

      {/* 稀有度 pills */}
      <div className="flex gap-1">
        {MEDAL_RARITIES.map((r) => (
          <Pill
            key={r}
            active={slot.tier === r}
            tone={r === "TB" ? "violet" : "magenta"}
            onClick={() => onMeta(tierKey, slot.tier === r ? null : r, medalKey)}
          >
            {r}
          </Pill>
        ))}
      </div>

      {/* 型號 pills */}
      <div className="flex flex-wrap gap-1">
        {MEDAL_TYPES.map((t) => (
          <Pill
            key={t}
            active={slot.type === t}
            tone="green"
            onClick={() => onMeta(typeKey, slot.type === t ? null : t, medalKey)}
          >
            {t}
          </Pill>
        ))}
      </div>

      {/* 勳章 picker (options carry the description) */}
      <div className="relative min-w-[12rem] flex-1">
        <select
          aria-label={`勳章欄位 ${index + 1}`}
          value={slot.medalId ?? ""}
          disabled={!ready}
          onChange={(e) => onMedal(medalKey, e.target.value || null)}
          className="calc-input w-full appearance-none pr-9 text-[0.95rem] disabled:opacity-40"
        >
          <option value="">{ready ? "選擇勳章…" : "先選稀有度與型號"}</option>
          {pool.map((mm) => {
            const ds = medalDesc(mm);
            return (
              <option key={mm.id} value={mm.id}>
                {ds === "—" ? mm.name : `${mm.name}（${ds}）`}
              </option>
            );
          })}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim"
        >
          ▼
        </span>
      </div>

      {/* selected medal stat */}
      {medalKeys.length ? (
        <div className="flex flex-wrap gap-1.5">
          {medalKeys.map((k) => (
            <span key={k} className="capsule text-[0.8rem]">
              {fmtStat(k, medal!.stats[k]!)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Pill({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "violet" | "magenta" | "green";
  onClick: () => void;
  children: ReactNode;
}) {
  const activeTone =
    tone === "violet"
      ? "border-violet bg-violet/20 text-violet"
      : tone === "magenta"
        ? "border-magenta bg-magenta/15 text-magenta"
        : "border-green bg-green/15 text-green";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-2 py-0.5 font-display text-[0.82rem] font-semibold uppercase tracking-wide transition-colors ${
        active ? activeTone : "border-line text-ink-dim hover:border-line-bright hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
