import type { Metadata } from "next";
import DamageCalculator from "@/components/damage/DamageCalculator";

export const metadata: Metadata = {
  title: "傷害計算",
  description:
    "靈魂行者傷害計算機 — 輸入攻擊力、技能倍率、暴擊與增傷，即時估算單擊、暴擊與期望傷害。",
};

/** /damage/ — interactive multi-tab damage calculator (client component below). */
export default function DamagePage() {
  return (
    <div className="mx-auto w-full px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="hud-chip">DAMAGE CALCULATOR</div>
        <h1 className="section-title mt-2">傷害計算</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim">
          依分頁（角色／裝備／稱號／特化／AR卡／增益）填入或選擇你的配置，數值會即時彙總。
          可建立多組配置，自動儲存在本機，並可匯出／匯入 JSON 檔備份。
          所有計算都在瀏覽器中完成，不會送出任何資料。
        </p>
        <p className="mt-2 max-w-2xl text-[0.82rem] leading-relaxed text-ink-dim">
          ⚠ 傷害已套用〈傷害篇〉預想公式（命中／爆擊／MISS）。裝備資料已匯入；特化改為互動式配點（節點效果數據待補）；勳章／AR卡／稱號／增益的預設數值仍待補。
        </p>
      </header>

      <DamageCalculator />
    </div>
  );
}
