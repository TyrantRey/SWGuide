"use client";

import { Fragment } from "react";
import type { MouseEvent, ReactNode } from "react";
import { STAT_KEYS, STAT_META } from "./config";
import {
  computeSpecStats,
  MAX_LEVEL,
  minNodePoints,
  nodeMax,
  nodeUnlocked,
  specPoints,
  specPool,
  specSpent,
  SP_LEVEL_OFFSET,
  SP_PER_LEVEL,
  SPEC_NODES,
  SPEC_PASSIVE_KEY,
  SPEC_TREES,
  treeSpent,
} from "./specialization";
import type { SpecIconKey, SpecNode, SpecTier, SpecTree } from "./specialization";

type Values = Record<string, number>;

const parseNum = (raw: string) => {
  if (raw === "") return 0;
  const num = Number(raw);
  return Number.isNaN(num) ? 0 : Math.max(0, num);
};
const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmt = (n: number) => NUM.format(n);

/**
 * 特化 tab: skill-multiplier inputs (傷害值/SA, consumed by the damage formula)
 * plus the interactive specialization grid. All point/SP/exclusivity logic is
 * pure here — every change produces a full next `values.specialization` map.
 */
export default function SpecializationPanel({
  values,
  level,
  onLevelChange,
  onChange,
}: {
  values: Values;
  level: number;
  onLevelChange: (v: number) => void;
  onChange: (next: Values) => void;
}) {
  const passive = values[SPEC_PASSIVE_KEY] ?? 0;
  // Pool = 等級 ×3 −2 − 技能頁面被動點數 (等級夾在上限). Level 0 (not set) = unlimited playground.
  const budgetOn = level > 0;
  const pool = specPool(level, passive);
  const spent = specSpent(values, level);
  const remaining = pool - spent;

  const setKey = (key: string, v: number) => onChange({ ...values, [key]: v });
  const unlocked = (node: SpecNode) => nodeUnlocked(values, node, level);

  /** Can this node take at least one more point? (locked / maxed / over-budget = no) */
  const affordable = (node: SpecNode, tier?: SpecTier): boolean => {
    if (specPoints(values, node, level) >= nodeMax(node, level)) return false;
    if (!nodeUnlocked(values, node, level)) return false;
    if (!budgetOn) return true;
    const exclude = new Set<string>([node.id]);
    if (tier) for (const s of tier.nodes) exclude.add(s.id);
    let other = 0;
    for (const m of SPEC_NODES) if (!exclude.has(m.id)) other += specPoints(values, m, level) * m.sp;
    return pool - other >= node.sp;
  };

  const allocate = (node: SpecNode, tier: SpecTier | undefined, dir: 1 | -1, e: MouseEvent) => {
    const next: Values = { ...values };
    const cur = specPoints(next, node, level);
    if (dir > 0) {
      // tier choose-one: clear siblings (frees their SP) before allocating
      if (tier) for (const s of tier.nodes) if (s.id !== node.id) next[s.id] = 0;
      if (!nodeUnlocked(next, node, level)) return; // gate not met (button is disabled too)
      let other = 0;
      for (const m of SPEC_NODES) if (m.id !== node.id) other += specPoints(next, m, level) * m.sp;
      const max = nodeMax(node, level);
      const cap =
        !budgetOn || node.sp <= 0 ? max : Math.floor(Math.max(0, pool - other) / node.sp);
      const step = e.shiftKey ? max : e.ctrlKey || e.metaKey ? 5 : 1;
      next[node.id] = Math.max(cur, Math.min(max, cur + step, cap));
    } else {
      // Clamp at the floor that keeps every dependent node's 前置 gate satisfied
      // (removing more would orphan a node that relies on this node's SP).
      const step = e.shiftKey ? cur : e.ctrlKey || e.metaKey ? 5 : 1;
      next[node.id] = Math.max(minNodePoints(next, node, level), cur - step);
    }
    onChange(next);
  };

  const reset = () => {
    const next: Values = { ...values };
    for (const node of SPEC_NODES) next[node.id] = 0;
    onChange(next);
  };

  const total = computeSpecStats(values, level);
  const totalKeys = STAT_KEYS.filter((k) => total[k]);

  return (
    <div className="flex flex-col gap-5">
      {/* skill multipliers — feed the damage formula directly */}
      {/* <div className="grid gap-3 sm:grid-cols-2">
        <SkillField
          label="傷害值"
          en="DMG VALUE %"
          value={values.dmgValue ?? 100}
          onChange={(v) => setKey("dmgValue", v)}
          hint="技能傷害倍率，預設 100%。"
        />
        <SkillField
          label="SA 傷害值"
          en="SA VALUE %"
          value={values.saValue ?? 100}
          onChange={(v) => setKey("saValue", v)}
          hint="破壞／霸體傷害倍率，預設 100%。"
        />
      </div> */}

      {/* SP budget — pool = 角色等級 ×3 −2 − 技能頁面被動點數 (level synced with 角色 tab) */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-line py-3">
        <label className="flex flex-col gap-1">
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-ink">角色等級</span>
            <span className="font-display text-[0.55rem] uppercase tracking-[0.16em] text-ink-faint">
              LEVEL
            </span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_LEVEL}
            value={level}
            onChange={(e) => onLevelChange(Math.min(MAX_LEVEL, parseNum(e.target.value)))}
            className="calc-input w-32"
          />
          <span className="text-[0.75rem] text-ink-dim">
            ×{SP_PER_LEVEL}−{SP_LEVEL_OFFSET} ＝ {Math.max(0, level * SP_PER_LEVEL - SP_LEVEL_OFFSET)}{" "}
            點（上限 Lv {MAX_LEVEL}）；與「角色」分頁同步。
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-ink">技能頁面被動點數</span>
            <span className="font-display text-[0.55rem] uppercase tracking-[0.16em] text-ink-faint">
              PASSIVE
            </span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={passive}
            onChange={(e) => setKey(SPEC_PASSIVE_KEY, parseNum(e.target.value))}
            className="calc-input w-32"
          />
          <span className="text-[0.75rem] text-ink-dim">技能頁面消耗的被動點數，自特化點數扣除。</span>
        </label>

        {budgetOn ? (
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-ink-dim">
              總計 <span className="font-display tabular-nums text-ink">{pool}</span>（{level}×
              {SP_PER_LEVEL}−{SP_LEVEL_OFFSET}
              {passive > 0 ? `−${passive}` : ""}）
            </span>
            <span className="text-ink-dim">
              已用 <span className="font-display tabular-nums text-ink">{spent}</span> / {pool}
            </span>
            <span className={remaining < 0 ? "text-red" : "text-green"}>
              剩餘 <span className="font-display tabular-nums">{remaining}</span>
            </span>
          </div>
        ) : (
          <div className="text-sm text-ink-dim">設定等級後啟用點數上限（0 ＝ 不限制）。</div>
        )}

        <button
          type="button"
          onClick={reset}
          className="ml-auto self-end border border-line px-3 py-1.5 font-display text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-dim transition-colors hover:border-red/60 hover:text-red"
        >
          ↺ 重設特化
        </button>
      </div>

      {/* the two trees — side-by-side only when there's room, else stacked */}
      <div className="grid gap-4 2xl:grid-cols-2">
        {SPEC_TREES.map((tree) => (
          <TreeColumn
            key={tree.id}
            tree={tree}
            values={values}
            level={level}
            affordable={affordable}
            unlocked={unlocked}
            onAlloc={allocate}
          />
        ))}
      </div>

      {/* shortcut hints */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-3 text-[0.8rem] text-ink-dim">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>Ctrl</Kbd>+點擊 ＝ +5 點
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>Shift</Kbd>+點擊 ＝ 最大/清空
        </span>
        <span>同階三選一：升級其一會清空同階其他節點。</span>
        <span>戰鬥／技術 2–5 與 Tier 需先在同系投入前置點數方能解鎖。</span>
      </div>

      {/* live contribution summary */}
      <div className="border-t border-line pt-3">
        <div className="mb-2 font-display text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-magenta">
          特化加成總計 · BONUS
        </div>
        {totalKeys.length ? (
          <div className="flex flex-wrap gap-1.5">
            {totalKeys.map((k) => (
              <span key={k} className="capsule capsule--accent text-[0.72rem]">
                {STAT_META[k].label} +{fmt(total[k]!)}
                {STAT_META[k].pct ? "%" : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[0.82rem] text-ink-dim">
            節點效果數據待補（specialization.ts 的 <code className="text-ink-dim">per</code>）；
            目前配點可正常運作但尚未產生加成。
          </p>
        )}
      </div>
    </div>
  );
}

function TreeColumn({
  tree,
  values,
  level,
  affordable,
  unlocked,
  onAlloc,
}: {
  tree: SpecTree;
  values: Values;
  level: number;
  affordable: (node: SpecNode, tier?: SpecTier) => boolean;
  unlocked: (node: SpecNode) => boolean;
  onAlloc: (node: SpecNode, tier: SpecTier | undefined, dir: 1 | -1, e: MouseEvent) => void;
}) {
  return (
    <div className="border border-line bg-surface/20 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 bg-green shadow-[0_0_8px_rgba(74,222,128,0.85)]" aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">{tree.name}</span>
        <span className="font-display text-[0.55rem] uppercase tracking-[0.2em] text-ink-faint">
          {tree.en}
        </span>
      </div>

      {/* master row — 5 across; fills wide, scrolls when tight */}
      <div className="grid grid-flow-col auto-cols-[minmax(4.75rem,1fr)] gap-1.5 overflow-x-auto pb-1">
        {tree.masters.map((node) => (
          <NodeTile
            key={node.id}
            node={node}
            values={values}
            level={level}
            affordable={affordable(node)}
            unlocked={unlocked(node)}
            onAlloc={(dir, e) => onAlloc(node, undefined, dir, e)}
          />
        ))}
      </div>

      {/* tiers (choose one per row) */}
      <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
        {tree.tiers.map((tier) => (
          <div key={tier.id} className="flex items-stretch gap-1.5 overflow-x-auto">
            <div className="flex w-12 shrink-0 flex-col justify-center">
              <span className="font-display text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-ink-dim">
                {tier.label}
              </span>
            </div>
            {tier.nodes.map((node, i) => (
              <Fragment key={node.id}>
                {i > 0 ? (
                  <span className="self-center text-sm text-ink-dim" aria-hidden="true">
                    ⇄
                  </span>
                ) : null}
                <NodeTile
                  node={node}
                  values={values}
                  level={level}
                  affordable={affordable(node, tier)}
                  unlocked={unlocked(node)}
                  onAlloc={(dir, e) => onAlloc(node, tier, dir, e)}
                />
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeTile({
  node,
  values,
  level,
  affordable,
  unlocked,
  onAlloc,
}: {
  node: SpecNode;
  values: Values;
  level: number;
  affordable: boolean;
  unlocked: boolean;
  onAlloc: (dir: 1 | -1, e: MouseEvent) => void;
}) {
  const pts = specPoints(values, node, level);
  const active = pts > 0;
  const max = nodeMax(node, level);
  const maxed = max > 0 && pts >= max;
  const locked = !unlocked;
  // Lowest this node may drop to without orphaning a dependent — disables − when reached.
  const floor = minNodePoints(values, node, level);
  // SP still needed in this tree to unlock — recomputed live as the tree fills.
  // Active-but-locked = orphaned (prerequisite later dropped); flagged red, not counted.
  const need = Math.max(0, node.req - (treeSpent(values, node.tree, level) - pts * node.sp));
  const status = maxed
    ? { text: "Master", cls: "text-green" }
    : locked
      ? { text: `需 ${need} 點`, cls: active ? "text-red" : "text-gold" }
      : !affordable
        ? { text: "SP不足", cls: "text-red" }
        : null;

  const border = active
    ? "border-green/70 bg-green/8"
    : locked
      ? "border-line/60 bg-surface/20 opacity-55"
      : "border-line bg-surface/30";

  return (
    <div
      className={`flex min-w-19 flex-1 flex-col items-center gap-1 border px-1 py-1.5 text-center transition-colors ${border}`}
    >
      <SpecIcon name={node.icon} className={active ? "text-green" : "text-ink-dim"} />
      <div className="flex items-center gap-0.5">
        <StepBtn label="−" disabled={pts <= floor} onClick={(e) => onAlloc(-1, e)} />
        <span
          className={`min-w-5 font-display text-base font-bold tabular-nums ${active ? "text-ink" : "text-ink-dim"
            }`}
        >
          {pts}
        </span>
        <StepBtn label="+" disabled={maxed || locked || !affordable} onClick={(e) => onAlloc(1, e)} />
      </div>
      {status ? (
        <span className={`font-display text-[0.66rem] font-semibold uppercase tracking-wide ${status.cls}`}>
          {status.text}
        </span>
      ) : (
        <span className="h-[0.9rem]" aria-hidden="true" />
      )}
      <span
        className="w-full truncate text-[0.74rem] font-medium leading-tight text-ink-dim"
        title={node.desc ? `${node.name}：${node.desc}` : node.name}
      >
        {node.name}
      </span>
    </div>
  );
}

function StepBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-5 w-5 shrink-0 items-center justify-center border border-line-bright text-xs leading-none text-green transition-colors hover:bg-green/15 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}

function SkillField({
  label,
  en,
  value,
  onChange,
  hint,
}: {
  label: string;
  en: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label} %</span>
        <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          {en}
        </span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={5}
        value={value}
        onChange={(e) => onChange(parseNum(e.target.value))}
        className="calc-input"
      />
      <span className="text-[0.76rem] leading-snug text-ink-dim">{hint}</span>
    </label>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border border-line-bright bg-surface px-1.5 py-0.5 font-display text-[0.68rem] font-semibold text-ink-dim">
      {children}
    </kbd>
  );
}

const ICON_PATHS: Record<SpecIconKey, ReactNode> = {
  sword: (
    <>
      <path d="M14.5 17.5 4 7V4h3l10.5 10.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
    </>
  ),
  swords: (
    <>
      <path d="M4 4l16 16" />
      <path d="M20 4 4 20" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  armor: <path d="M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9z" />,
  hook: <path d="M14 4a3 3 0 0 0-3 3v7a3 3 0 1 1-3-3" />,
  drop: <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />,
  heart: (
    <path d="M12 20.5 10.6 19.2C5.4 14.4 2 11.3 2 7.6 2 5 4 3 6.5 3c1.7 0 3.3.9 4.5 2.3C12.2 3.9 13.8 3 15.5 3 18 3 20 5 20 7.6c0 3.7-3.4 6.8-8.6 11.6L12 20.5z" />
  ),
  star: <path d="M12 3l2.5 5.6 6 .8-4.5 4 1.2 6.1L12 16.8 6.8 19.5 8 13.4l-4.5-4 6-.8z" />,
  flame: (
    <path d="M12 3c.5 2.5 2 4.4 3.5 6 1.5 1.6 2.5 3.3 2.5 5.5a6 6 0 1 1-12 0c0-1.1.4-2.2 1-3a2.5 2.5 0 0 0 2.5 2.5A2.5 2.5 0 0 0 12 11.5c0-1.4-.5-2-1-3-1-2 0-4 1-5.5z" />
  ),
  bolt: <path d="M11 2 4 13h6l-1 9 9-12h-6l1-8z" />,
  up: (
    <>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </>
  ),
  down: (
    <>
      <path d="M12 5v14" />
      <path d="m5 12 7 7 7-7" />
    </>
  ),
};

function SpecIcon({ name, className }: { name: SpecIconKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 ${className ?? ""}`}
      aria-hidden="true"
    >
      {ICON_PATHS[name] ?? ICON_PATHS.sword}
    </svg>
  );
}
