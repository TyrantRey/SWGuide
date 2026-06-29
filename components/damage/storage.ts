// Persistence for the damage calculator: localStorage auto-save + JSON file
// export/import. All client-side — compatible with static export.

import type { Profile, Workspace } from "./types";

const KEY = "swguide:damage:v1";
const FORMAT = "swguide-damage";
const VERSION = 1;

/** Returns the saved workspace, or null when nothing valid is stored. */
export function loadWorkspace(): Workspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Workspace;
    if (!parsed || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkspace(ws: Workspace): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ws));
  } catch {
    /* quota / private mode — ignore */
  }
}

function download(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Download the given profiles as a versioned JSON file. */
export function exportProfiles(profiles: Profile[], label: string): void {
  const safe = label.replace(/[^\w一-鿿-]+/g, "") || "profile";
  download(`swguide-damage-${safe}-${stamp()}.json`, {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
  });
}

/** Parse + validate an uploaded file. Throws a zh-TW message on bad input. */
export async function importFile(file: File): Promise<Profile[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("無法解析 JSON 檔案。");
  }
  const obj = parsed as { format?: string; profiles?: unknown };
  if (obj?.format !== FORMAT) throw new Error("檔案格式不符（需為 swguide-damage 匯出檔）。");
  if (!Array.isArray(obj.profiles) || obj.profiles.length === 0) {
    throw new Error("檔案內沒有任何配置。");
  }
  const out: Profile[] = [];
  for (const raw of obj.profiles as Profile[]) {
    if (!raw || typeof raw !== "object" || !raw.data) continue;
    out.push({
      id: typeof raw.id === "string" ? raw.id : "",
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "匯入配置",
      data: raw.data,
    });
  }
  if (out.length === 0) throw new Error("檔案內的配置資料無效。");
  return out;
}
