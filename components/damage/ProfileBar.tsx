"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Workspace } from "./types";

interface Props {
  workspace: Workspace;
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onExportActive: () => void;
  onExportAll: () => void;
  onImport: (file: File) => void;
  importError?: string | null;
}

/** Top bar: switch / add / rename / duplicate / delete profiles + export / import.
 *  Rename is inline-edit; delete is an inline two-step confirm (no window.prompt/confirm,
 *  which aren't supported under static export). */
export default function ProfileBar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const skipCommit = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { workspace, activeId } = props;
  const single = workspace.profiles.length <= 1;

  const startEdit = (id: string, current: string) => {
    setConfirmId(null);
    setEditName(current);
    setEditingId(id);
  };
  const commit = () => {
    if (skipCommit.current) {
      skipCommit.current = false;
      setEditingId(null);
      return;
    }
    if (editingId && editName.trim()) props.onRename(editingId, editName.trim());
    setEditingId(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    else if (e.key === "Escape") {
      skipCommit.current = true;
      e.currentTarget.blur();
    }
  };

  return (
    <div className="panel panel-static p-3 sm:p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="hud-chip">PROFILES</span>
        <span className="font-display text-[0.66rem] tracking-[0.25em] text-ink-dim">
          本機儲存 · LOCAL
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {workspace.profiles.map((p) => {
          const on = p.id === activeId;
          const editing = editingId === p.id;
          const confirming = confirmId === p.id;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 border px-2.5 py-1 transition-colors ${
                on ? "border-cyan/60 text-cyan" : "border-line text-ink-dim hover:text-ink"
              }`}
            >
              {editing ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={onKey}
                  onBlur={commit}
                  className="calc-input w-28 px-2 py-0.5 text-sm"
                />
              ) : (
                <button type="button" onClick={() => props.onSwitch(p.id)} className="text-sm font-medium">
                  {on ? "● " : ""}
                  {p.name}
                </button>
              )}

              {on && !editing && !confirming ? (
                <>
                  <button
                    type="button"
                    title="重新命名"
                    onClick={() => startEdit(p.id, p.name)}
                    className="text-ink-dim transition-colors hover:text-cyan"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    title="複製"
                    onClick={() => props.onDuplicate(p.id)}
                    className="text-ink-dim transition-colors hover:text-cyan"
                  >
                    ⧉
                  </button>
                  {!single ? (
                    <button
                      type="button"
                      title="刪除"
                      onClick={() => setConfirmId(p.id)}
                      className="text-ink-dim transition-colors hover:text-red"
                    >
                      ✕
                    </button>
                  ) : null}
                </>
              ) : null}

              {on && confirming ? (
                <span className="flex items-center gap-1 text-[0.72rem] text-ink-dim">
                  刪除？
                  <button
                    type="button"
                    onClick={() => {
                      props.onDelete(p.id);
                      setConfirmId(null);
                    }}
                    className="font-semibold text-red"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-ink-dim hover:text-ink"
                  >
                    ✗
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={props.onAdd}
          className="border border-dashed border-line-bright px-2.5 py-1 text-sm text-ink-dim transition-colors hover:border-cyan/60 hover:text-cyan"
        >
          ＋ 新增
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-[0.72rem] font-semibold uppercase tracking-[0.12em]">
          <button type="button" onClick={props.onReset} className="text-ink-dim transition-colors hover:text-cyan">
            ↺ 重設
          </button>
          <button type="button" onClick={props.onExportActive} className="text-ink-dim transition-colors hover:text-cyan">
            ⤓ 匯出
          </button>
          <button type="button" onClick={props.onExportAll} className="text-ink-dim transition-colors hover:text-cyan">
            ⤓ 全部
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-ink-dim transition-colors hover:text-cyan"
          >
            ⤒ 匯入
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {props.importError ? (
        <p className="mt-2 text-[0.78rem] text-red">⚠ {props.importError}</p>
      ) : null}
    </div>
  );
}
