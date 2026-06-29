"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  aggregate,
  CHARACTERS,
  defaultProfileData,
  presetsFor,
  STAT_KEYS,
  STAT_META,
  TABS,
  TARGET_FIELDS,
} from "./config";
import type { Aggregate } from "./config";
import {
  ATTR_COUNT,
  ATTR_POOL,
  attrStatKey,
  attrValKey,
  BALLS,
  ballStatKey,
  ballValKey,
  detectSets,
  EQUIPMENT_SLOTS,
  gearKind,
  TAG_POOL,
  tagStatKey,
  tagValKey,
} from "./equipment";
import type { Preset, Profile, ProfileData, SlotDef, StatKey, TabId, Workspace } from "./types";
import { exportProfiles, importFile, loadWorkspace, saveWorkspace } from "./storage";
import ProfileBar from "./ProfileBar";
import SpecializationPanel from "./SpecializationPanel";
import MedalPanel from "./MedalPanel";

/* Deterministic initial state (matches the statically-prerendered HTML); real
   localStorage is loaded in an effect after hydration to avoid a mismatch. */
const INITIAL: Workspace = {
  activeId: "default",
  profiles: [{ id: "default", name: "預設", data: defaultProfileData() }],
};

const TAB_ACCENT: Record<TabId, string> = {
  equipment: "text-cyan",
  medal: "text-gold",
  specialization: "text-magenta",
  arcard: "text-violet",
  title: "text-gold",
  character: "text-cyan",
  buff: "text-green",
};

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmt = (n: number) => (Number.isFinite(n) ? NUM.format(Math.round(n)) : "—");
const parseNum = (raw: string) => {
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? 0 : n;
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "p" + Math.random().toString(36).slice(2, 10);
}

export default function DamageCalculator() {
  const [ws, setWs] = useState<Workspace>(INITIAL);
  const [tabId, setTabId] = useState<TabId>("character");
  const [hydrated, setHydrated] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadWorkspace();
    if (stored) setWs(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveWorkspace(ws);
  }, [ws, hydrated]);

  const active = ws.profiles.find((p) => p.id === ws.activeId) ?? ws.profiles[0];
  const data = active.data;
  const tab = TABS.find((t) => t.id === tabId)!;
  const agg = useMemo(() => aggregate(data), [data]);
  const dmg = useMemo(() => computeDamage(agg), [agg]);

  /* ---- data mutations (active profile) ---- */
  const updateActive = (mut: (d: ProfileData) => ProfileData) =>
    setWs((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === prev.activeId ? { ...p, data: mut(p.data) } : p)),
    }));

  const setFree = (t: string, key: string, val: number) =>
    updateActive((d) => ({ ...d, values: { ...d.values, [t]: { ...d.values[t], [key]: val } } }));

  const setPick = (t: string, slot: string, presetId: string | null) =>
    updateActive((d) => ({ ...d, picks: { ...d.picks, [t]: { ...d.picks[t], [slot]: presetId } } }));

  /** Replace the whole 特化 value map (the panel computes points/SP/exclusivity). */
  const setSpec = (next: Record<string, number>) =>
    updateActive((d) => ({ ...d, values: { ...d.values, specialization: next } }));

  /** Replace the whole 勳章 picks map (the panel drives the type/rarity/slot cascade). */
  const setMedal = (next: Record<string, string | null>) =>
    updateActive((d) => ({ ...d, picks: { ...d.picks, medal: next } }));

  /* ---- profile ops ---- */
  const switchTo = (id: string) => setWs((p) => ({ ...p, activeId: id }));
  const addProfile = () => {
    const prof: Profile = {
      id: newId(),
      name: `配置 ${ws.profiles.length + 1}`,
      data: defaultProfileData(),
    };
    setWs((p) => ({ activeId: prof.id, profiles: [...p.profiles, prof] }));
  };
  const renameProfile = (id: string, name: string) =>
    setWs((p) => ({ ...p, profiles: p.profiles.map((x) => (x.id === id ? { ...x, name } : x)) }));
  const duplicateProfile = (id: string) => {
    const src = ws.profiles.find((x) => x.id === id);
    if (!src) return;
    const copy: Profile = {
      id: newId(),
      name: `${src.name} 複本`,
      data: JSON.parse(JSON.stringify(src.data)) as ProfileData,
    };
    setWs((p) => ({ activeId: copy.id, profiles: [...p.profiles, copy] }));
  };
  const deleteProfile = (id: string) =>
    setWs((p) => {
      if (p.profiles.length <= 1) return p;
      const profiles = p.profiles.filter((x) => x.id !== id);
      const activeId = p.activeId === id ? profiles[0].id : p.activeId;
      return { activeId, profiles };
    });
  const resetActive = () => updateActive(() => defaultProfileData());

  const exportActive = () => exportProfiles([active], active.name);
  const exportAll = () => exportProfiles(ws.profiles, "all");
  const doImport = async (file: File) => {
    setImportError(null);
    try {
      const imported = await importFile(file);
      const withIds = imported.map((p) => ({ ...p, id: newId() }));
      setWs((prev) => ({
        activeId: withIds[0]?.id ?? prev.activeId,
        profiles: [...prev.profiles, ...withIds],
      }));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "匯入失敗");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ProfileBar
        workspace={ws}
        activeId={active.id}
        onSwitch={switchTo}
        onAdd={addProfile}
        onRename={renameProfile}
        onDuplicate={duplicateProfile}
        onDelete={deleteProfile}
        onReset={resetActive}
        onExportActive={exportActive}
        onExportAll={exportAll}
        onImport={doImport}
        importError={importError}
      />

      <div className="grid gap-5 lg:grid-cols-[160px_minmax(0,1fr)_300px]">
        {/* ---- left: vertical tab rail ---- */}
        <nav className="panel panel-static flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
          {TABS.map((t) => {
            const on = t.id === tabId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabId(t.id)}
                className={`group relative flex shrink-0 flex-col px-3 py-2 text-left transition-colors ${on ? "text-cyan" : "text-ink-dim hover:text-ink"
                  }`}
              >
                <span className="text-sm font-medium">{t.label}</span>
                <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.22em] opacity-60">
                  {t.en}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 transition-all lg:bottom-1.5 lg:right-auto lg:top-1.5 lg:h-auto lg:w-0.5 ${on
                      ? "bg-cyan shadow-[0_0_10px_rgba(61,232,255,0.8)]"
                      : "bg-transparent group-hover:bg-line-bright"
                    }`}
                />
              </button>
            );
          })}
        </nav>

        {/* ---- center: active tab ---- */}
        <section className="panel panel-static min-w-0 p-5 sm:p-6">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className={`font-display text-lg font-bold tracking-wide ${TAB_ACCENT[tab.id]}`}>
              {tab.label}
            </h2>
            <span className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-ink-faint">
              {tab.en}
            </span>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`font-display text-[0.55rem] font-semibold uppercase tracking-[0.2em] ${tab.mode === "free" ? "text-cyan" : "text-gold"
                }`}
            >
              {tab.mode === "free" ? "可填入數值 · EDITABLE" : "固定數值選擇 · FIXED"}
            </span>
            {tab.note ? <span className="text-[0.82rem] text-ink-dim">— {tab.note}</span> : null}
          </div>

          {tab.id === "specialization" ? (
            <SpecializationPanel
              values={data.values.specialization ?? {}}
              level={data.values.character?.level ?? 0}
              onLevelChange={(v) => setFree("character", "level", v)}
              onChange={setSpec}
            />
          ) : tab.id === "medal" ? (
            <MedalPanel picks={data.picks.medal ?? {}} onChange={setMedal} />
          ) : tab.mode === "free" ? (
            <div className="flex flex-col gap-4">
              {tab.id === "character" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">角色</span>
                    <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      CHARACTER
                    </span>
                  </span>
                  <div className="relative">
                    <select
                      value={data.picks.character?.char ?? ""}
                      onChange={(e) => setPick("character", "char", e.target.value || null)}
                      className="calc-input w-full appearance-none pr-9"
                    >
                      <option value="">— 選擇角色 —</option>
                      {CHARACTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{c.weapon}）
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim"
                    >
                      ▼
                    </span>
                  </div>
                </label>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                {tab.fields!.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {f.label}
                        {f.pct ? " %" : ""}
                      </span>
                      <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                        {f.en}
                      </span>
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={f.step ?? 1}
                      value={data.values[tab.id]?.[f.key] ?? 0}
                      onChange={(e) => setFree(tab.id, f.key, parseNum(e.target.value))}
                      className="calc-input"
                    />
                    {f.hint ? (
                      <span className="text-[0.76rem] leading-snug text-ink-dim">{f.hint}</span>
                    ) : null}
                  </label>
                ))}
              </div>
            </div>
          ) : tab.id === "equipment" ? (
            <EquipmentPanel
              picks={data.picks.equipment ?? {}}
              values={data.values.equipment ?? {}}
              onPick={(slotId, id) => setPick("equipment", slotId, id)}
              onValue={(key, v) => setFree("equipment", key, v)}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {groupSlots(tab.slots!).map((g, gi) => (
                <div key={g.name ?? gi}>
                  {g.name ? (
                    <div className="mb-2 font-display text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink-faint">
                      {g.name}
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.items.map((s) => (
                      <SlotCard
                        key={s.id}
                        slot={s}
                        options={presetsFor(tab.id, s.id)}
                        selId={data.picks[tab.id]?.[s.id] ?? null}
                        onChange={(id) => setPick(tab.id, s.id, id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- right: aggregate + target + stubbed total ---- */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
          <div className="panel p-5">
            <div className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-ink-faint">
              Aggregated Stats
            </div>
            <div className="mt-0.5 font-display text-xs font-semibold tracking-[0.2em] text-ink-dim">
              彙總屬性
            </div>
            <div className="mt-3 grid gap-2">
              {STAT_KEYS.map((k) => (
                <StatRow
                  key={k}
                  label={`${STAT_META[k].label}${STAT_META[k].pct ? " %" : ""}`}
                  en={STAT_META[k].en}
                  value={agg.stats[k]}
                />
              ))}
              <StatRow label="等級" en="LEVEL" value={agg.level} />
            </div>
          </div>

          <div className="panel panel-static p-5">
            <div className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-ink-faint">
              Target
            </div>
            <div className="mt-0.5 font-display text-xs font-semibold tracking-[0.2em] text-ink-dim">
              目標設定
            </div>
            <div className="mt-3 grid gap-3">
              {TARGET_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-3">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-ink-dim">
                      {f.label}
                      {f.pct ? " %" : ""}
                    </span>
                    <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                      {f.en}
                    </span>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={f.step ?? 1}
                    value={data.values.target?.[f.key] ?? 0}
                    onChange={(e) => setFree("target", f.key, parseNum(e.target.value))}
                    className="calc-input max-w-[8.5rem]"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <div className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-ink-faint">
              Total Damage
            </div>
            <div className="mt-0.5 font-display text-xs font-semibold tracking-[0.2em] text-ink-dim">
              傷害預想
            </div>
            <div className="mt-2 flex items-baseline justify-between text-[0.76rem] text-ink-dim">
              <span>攻擊力 {fmt(dmg.atk)}</span>
              <span>防禦減傷 {(dmg.defReduce * 100).toFixed(1)}%</span>
            </div>

            <DamageBlock title="傷害" en={`SKILL ${agg.dmgValue}%`} tone="cyan" d={dmg.normal} />
            <DamageBlock title="SA 傷害" en={`SA ${agg.saValue}%`} tone="magenta" d={dmg.sa} />
          </div>

          <div className="callout callout--note">
            <div className="callout-title">
              <span className="callout-icon" aria-hidden="true" />
              計算公式
            </div>
            <div className="callout-body text-[0.82rem] leading-relaxed">
              <p>
                命中 ＝ 攻擊力 ×(1+B傷%)× 技能% ×(1−減傷%)；爆擊則 (攻擊力＋爆傷)；MISS 再 × 攻擊失敗倍率。
              </p>
              <p className="text-ink-dim">
                攻擊力 ＝ 面板攻擊力 ×(1+攻擊力%)；減傷 ＝ 1−(1−防禦減傷)(1−BOSS減傷)，
                防禦減傷 ＝ 有效防禦 ÷(有效防禦＋等級×50)，有效防禦 ＝ 防禦度 ×(1−貫穿)。
                部分分頁預設項目數值仍待補；配置自動存於本機，可匯出／匯入 JSON。
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Split slots into consecutive groups by their optional `group` label. */
function groupSlots(slots: SlotDef[]): { name?: string; items: SlotDef[] }[] {
  const out: { name?: string; items: SlotDef[] }[] = [];
  for (const s of slots) {
    let last = out[out.length - 1];
    if (!last || last.name !== s.group) {
      last = { name: s.group, items: [] };
      out.push(last);
    }
    last.items.push(s);
  }
  return out;
}

function hasStats(p: Preset): boolean {
  return STAT_KEYS.some((k) => p.stats[k]);
}

function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 font-display text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-ink-faint">
      {children}
    </div>
  );
}

/** One gear-piece card: 標籤 → 固定詞條(picked gear) → 附加詞條 → 鑲嵌道具. */
function PieceCard({
  slot,
  options,
  picks,
  values,
  onPick,
  onValue,
}: {
  slot: SlotDef;
  options: Preset[];
  picks: Record<string, string | null>;
  values: Record<string, number>;
  onPick: (key: string, id: string | null) => void;
  onValue: (key: string, v: number) => void;
}) {
  const kind = gearKind(slot.id);
  const gearSel = picks[slot.id] ?? null;
  const preset = options.find((p) => p.id === gearSel) ?? null;
  const balls = BALLS[kind];

  return (
    <div className="border border-line bg-surface/30">
      {/* 標籤 */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-cyan/[0.06] px-3 py-2">
        <span className="text-sm font-semibold text-cyan">{slot.label}</span>
        <span className="font-display text-[0.55rem] uppercase tracking-[0.2em] text-ink-faint">
          {slot.en}
        </span>
        <span className="ml-1 text-[0.75rem] text-ink-dim">標籤</span>
        <AttrEntry
          options={TAG_POOL[kind]}
          selStat={(picks[tagStatKey(slot.id)] as StatKey | null) ?? null}
          value={values[tagValKey(slot.id)] ?? 0}
          onStat={(st) => onPick(tagStatKey(slot.id), st)}
          onValue={(v) => onValue(tagValKey(slot.id), v)}
        />
      </div>

      {/* 固定詞條 (gear pick) */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2">
        <div className="relative min-w-[11rem] flex-1">
          <select
            value={gearSel ?? ""}
            onChange={(e) => onPick(slot.id, e.target.value || null)}
            className="calc-input w-full appearance-none pr-9"
          >
            <option value="">— 無 —</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim"
          >
            ▼
          </span>
        </div>
        {preset && hasStats(preset) ? (
          <div className="flex flex-wrap gap-1.5">
            {STAT_KEYS.filter((k) => preset.stats[k]).map((k) => (
              <span key={k} className="capsule text-[0.7rem]">
                {STAT_META[k].label} +{preset.stats[k]}
                {STAT_META[k].pct ? "%" : ""}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[0.76rem] text-ink-dim">固定詞條（選擇裝備後帶入）</span>
        )}
      </div>

      {/* 附加詞條 */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="w-12 shrink-0 text-[0.72rem] font-medium text-green">附加詞條</span>
        {Array.from({ length: ATTR_COUNT }).map((_, i) => (
          <AttrEntry
            key={i}
            options={ATTR_POOL[kind]}
            selStat={(picks[attrStatKey(slot.id, i)] as StatKey | null) ?? null}
            value={values[attrValKey(slot.id, i)] ?? 0}
            onStat={(st) => onPick(attrStatKey(slot.id, i), st)}
            onValue={(v) => onValue(attrValKey(slot.id, i), v)}
          />
        ))}
      </div>

      {/* 鑲嵌道具 */}
      {balls.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
          <span className="w-12 shrink-0 text-[0.72rem] font-medium text-violet">鑲嵌道具</span>
          {balls.map((b) => (
            <div key={b.id} className="flex items-center gap-1">
              <span className="text-[0.7rem] text-ink-dim">{b.label}</span>
              {b.pool.length ? (
                <AttrEntry
                  options={b.pool}
                  selStat={(picks[ballStatKey(slot.id, b.id)] as StatKey | null) ?? null}
                  value={values[ballValKey(slot.id, b.id)] ?? 0}
                  onStat={(st) => onPick(ballStatKey(slot.id, b.id), st)}
                  onValue={(v) => onValue(ballValKey(slot.id, b.id), v)}
                />
              ) : (
                <span className="text-[0.72rem] text-ink-dim">無傷害</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A selectable stat roll: pick which stat from `options`, then enter its value. */
function AttrEntry({
  options,
  selStat,
  value,
  onStat,
  onValue,
}: {
  options: StatKey[];
  selStat: StatKey | null;
  value: number;
  onStat: (stat: StatKey | null) => void;
  onValue: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <select
          value={selStat ?? ""}
          onChange={(e) => onStat((e.target.value || null) as StatKey | null)}
          className="calc-input w-28 appearance-none pr-7 text-[0.82rem]"
        >
          <option value="">詞條…</option>
          {options.map((st) => (
            <option key={st} value={st}>
              {STAT_META[st].label}
              {STAT_META[st].pct ? "%" : ""}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[0.75rem] text-ink-dim"
        >
          ▼
        </span>
      </div>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        disabled={!selStat}
        onChange={(e) => onValue(parseNum(e.target.value))}
        className="calc-input w-24 disabled:opacity-40"
      />
    </div>
  );
}

/** The whole 裝備 tab: one card per gear piece + auto set summary. */
function EquipmentPanel({
  picks,
  values,
  onPick,
  onValue,
}: {
  picks: Record<string, string | null>;
  values: Record<string, number>;
  onPick: (key: string, id: string | null) => void;
  onValue: (key: string, v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groupSlots(EQUIPMENT_SLOTS).map((g, gi) => (
        <div key={g.name ?? gi}>
          {g.name ? <GroupHeader>{g.name}</GroupHeader> : null}
          <div className="flex flex-col gap-3">
            {g.items.map((slot) => (
              <PieceCard
                key={slot.id}
                slot={slot}
                options={presetsFor("equipment", slot.id)}
                picks={picks}
                values={values}
                onPick={onPick}
                onValue={onValue}
              />
            ))}
          </div>
        </div>
      ))}
      <SetSummary picks={picks} />
    </div>
  );
}

/** Auto-detected set bonuses for the 裝備 tab (read-only). */
function SetSummary({ picks }: { picks: Record<string, string | null> }) {
  const sets = detectSets(picks);
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-2 font-display text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">
        套裝效果（自動） · SET BONUS
      </div>
      {sets.length === 0 ? (
        <p className="text-[0.82rem] text-ink-dim">
          尚未達成套裝（需同系列裝備達 2 件以上）。
        </p>
      ) : (
        <div className="grid gap-2">
          {sets.map((s) => {
            const damage = STAT_KEYS.filter((k) => s.stats[k]);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-ink">{s.name}</span>
                <span className="font-display text-[0.66rem] tracking-wide text-ink-dim">
                  ×{s.count}
                </span>
                {damage.map((k) => (
                  <span key={k} className="capsule capsule--accent text-[0.72rem]">
                    {STAT_META[k].label} +{s.stats[k]}
                    {STAT_META[k].pct ? "%" : ""}
                  </span>
                ))}
                {damage.length === 0 ? (
                  <span className="text-[0.76rem] text-ink-dim">（無傷害數值）</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  options,
  selId,
  onChange,
}: {
  slot: SlotDef;
  options: Preset[];
  selId: string | null;
  onChange: (id: string | null) => void;
}) {
  const preset = options.find((p) => p.id === selId) ?? null;
  return (
    <div className="border border-line bg-surface/40 p-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-medium text-ink">{slot.label}</span>
        {slot.en ? (
          <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            {slot.en}
          </span>
        ) : null}
      </div>
      <div className="relative">
        <select
          value={selId ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="calc-input w-full appearance-none pr-9"
        >
          <option value="">— 無 —</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim"
        >
          ▼
        </span>
      </div>
      {preset && hasStats(preset) ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STAT_KEYS.filter((k) => preset.stats[k]).map((k) => (
            <span key={k} className="capsule text-[0.72rem]">
              {STAT_META[k].label} +{preset.stats[k]}
              {STAT_META[k].pct ? "%" : ""}
            </span>
          ))}
        </div>
      ) : null}
      {preset && !hasStats(preset) ? (
        <p className="mt-2 text-[0.75rem] text-ink-dim">無傷害相關詞條（防禦／套裝用途）。</p>
      ) : null}
      {options.length === 0 ? (
        <p className="mt-2 text-[0.76rem] text-ink-dim">尚未建立此分類的預設資料（待補）。</p>
      ) : null}
    </div>
  );
}

function StatRow({ label, en, value }: { label: string; en: string; value: number }) {
  const zero = !value;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5 last:border-0">
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink-dim">{label}</span>
        <span className="font-display text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          {en}
        </span>
      </span>
      <span
        className={`font-display text-lg font-bold tabular-nums ${zero ? "text-ink-dim" : "text-ink"}`}
      >
        {fmt(value)}
      </span>
    </div>
  );
}

interface SkillDamage {
  hit: number;
  crit: number;
  miss: number;
}
interface DamageOut {
  atk: number;
  defReduce: number; // 0–1
  normal: SkillDamage;
  sa: SkillDamage;
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/**
 * 傷害預想公式 (傷害篇):
 *   命中     = 攻擊力 ×(1+B傷%)× 技能% ×(1−減傷%)
 *   命中爆擊 = (攻擊力+爆傷) ×(1+B傷%)× 技能% ×(1−減傷%)
 *   MISS     = 命中 × 攻擊失敗%
 * 攻擊力 = 面板攻擊力 ×(1+攻擊力%)；減傷 = 1−(1−防禦減傷)(1−BOSS減傷)，
 * 防禦減傷 = 有效防禦 ÷(有效防禦+等級×50)，有效防禦 = 防禦度 ×(1−貫穿)。
 */
function computeDamage(agg: Aggregate): DamageOut {
  const s = agg.stats;
  const atk = s.atkFlat * (1 + s.atkPct / 100);
  const critFlat = s.critDmg;
  const bMul = 1 + s.bDmg / 100;

  const effDef = Math.max(0, agg.target.defense * (1 - clampPct(s.penetration) / 100));
  const denom = effDef + agg.level * 50;
  const defReduce = denom > 0 ? effDef / denom : 0;
  const mitig = (1 - defReduce) * (1 - clampPct(agg.target.bossReduction) / 100);
  const fail = agg.target.attackFail / 100;

  const calc = (skillPct: number): SkillDamage => {
    const skill = skillPct / 100;
    const hit = atk * bMul * skill * mitig;
    const crit = (atk + critFlat) * bMul * skill * mitig;
    return { hit, crit, miss: hit * fail };
  };

  return { atk, defReduce, normal: calc(agg.dmgValue), sa: calc(agg.saValue) };
}

function DmgRow({
  label,
  en,
  value,
  emphasize,
}: {
  label: string;
  en: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5 last:border-0">
      <span className="flex flex-col">
        <span className={emphasize ? "text-sm font-semibold text-ink" : "text-sm font-medium text-ink-dim"}>
          {label}
        </span>
        <span className="font-display text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          {en}
        </span>
      </span>
      <span
        className={`font-display font-bold tabular-nums ${emphasize ? "neon-text text-xl" : "text-base text-ink-dim"
          }`}
      >
        {fmt(value)}
      </span>
    </div>
  );
}

function DamageBlock({
  title,
  en,
  tone,
  d,
}: {
  title: string;
  en: string;
  tone: "cyan" | "magenta";
  d: SkillDamage;
}) {
  const color = tone === "cyan" ? "text-cyan" : "text-magenta";
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${color}`}>{title}</span>
        <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          {en}
        </span>
      </div>
      <div className="grid gap-1.5">
        <DmgRow label="命中" en="HIT" value={d.hit} />
        <DmgRow label="命中爆擊" en="CRIT" value={d.crit} emphasize />
        <DmgRow label="MISS" en="MISS" value={d.miss} />
      </div>
    </div>
  );
}
