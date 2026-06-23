import type { Metadata } from "next";
import DamageCalculator from "@/components/damage/DamageCalculator";

export const metadata: Metadata = {
  title: "傷害計算",
  description:
    "靈魂行者傷害計算機 — 輸入攻擊力、技能倍率、暴擊與增傷，即時估算單擊、暴擊與期望傷害。",
};

/** /damage/ — interactive damage calculator (client component below). */
export default function DamagePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <header className="mb-8">
        <div className="hud-chip">DAMAGE CALCULATOR</div>
        <h1 className="section-title mt-2">傷害計算</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim">
          調整下方數值，即時估算單擊、暴擊與期望傷害。所有計算都在瀏覽器中完成，不會送出任何資料。
        </p>
      </header>

      <DamageCalculator />
    </div>
  );
}
