import { useRef, useState } from "react";
import { normalizeTag, tagKey } from "@/lib/patch-library/metadata";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TAGS_PER_PRESET,
  MAX_TAG_LENGTH,
  PRESET_CATEGORIES,
  type PresetCategory,
} from "@/lib/patch-library/types";
import type { SaveAsFields } from "./usePatchLibrary";
import { PatchDialogShell } from "./PatchDialogShell";
import { TxSelect } from "../TxSelect";

const CATEGORY_OPTIONS = PRESET_CATEGORIES.map((c) => ({ value: c, label: c }));

const FIELD_LABEL = "text-[9px] tracking-[0.25em] text-tx-muted";
const FIELD_INPUT =
  "tx-lcd-box w-full px-2 py-2 text-[12px] tracking-wider outline-none focus:ring-1 focus:ring-[color:var(--tx-lcd-dim)]";

/**
 * Save As / Rename dialog. Metadata only — the DSP patch payload is captured
 * by the controller at submit time. Author and pack use library defaults;
 * category, tags and description are user-editable on save.
 */
export function PatchSaveDialog({
  mode,
  defaults,
  suggestedTags,
  onSubmit,
  onCancel,
}: {
  mode: "save" | "rename";
  defaults: SaveAsFields;
  suggestedTags: string[];
  onSubmit: (fields: SaveAsFields) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaults.name);
  const [category, setCategory] = useState<PresetCategory>(defaults.category);
  const [tags, setTags] = useState<string[]>(defaults.tags);
  const [tagInput, setTagInput] = useState("");
  const [description, setDescription] = useState(defaults.description);
  const [error, setError] = useState<string | null>(null);

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    setTags((prev) => {
      if (prev.length >= MAX_TAGS_PER_PRESET) return prev;
      if (prev.some((x) => tagKey(x) === tagKey(t))) return prev;
      return [...prev, t];
    });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => tagKey(x) !== tagKey(t)));
  };

  // One-shot guard: a rapid double-submit (Enter + click, or a double-tap on
  // touch screens) fires twice before the dialog unmounts — without this the
  // second call would append a duplicate library entry.
  const submittedRef = useRef(false);
  const submit = () => {
    if (submittedRef.current) return;
    if (!name.replace(/\s+/g, " ").trim()) {
      setError("NAME REQUIRED");
      return;
    }
    submittedRef.current = true;
    onSubmit({ ...defaults, name, category, tags, description });
  };

  const unusedSuggestions = suggestedTags
    .filter((t) => !tags.some((x) => tagKey(x) === tagKey(t)))
    .slice(0, 24);

  return (
    <PatchDialogShell
      title={mode === "save" ? "SAVE PRESET" : "RENAME PRESET"}
      onCancel={onCancel}
      wide={mode === "save"}
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>NAME</span>
          <input
            className={FIELD_INPUT}
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="PRESET NAME"
            aria-label="Preset name"
          />
        </label>

        {mode === "save" && (
          <>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>CATEGORY</span>
              <TxSelect
                className="w-full text-left"
                style={{ minHeight: 44 }}
                value={category}
                options={CATEGORY_OPTIONS}
                onChange={(v) => setCategory(v)}
                ariaLabel="Preset category"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>
                TAGS · {tags.length}/{MAX_TAGS_PER_PRESET}
              </span>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <button
                      key={tagKey(t)}
                      type="button"
                      className="tx-btn px-2"
                      style={{ minHeight: 32, paddingTop: 4, paddingBottom: 4 }}
                      onClick={() => removeTag(t)}
                      aria-label={`Remove tag ${t}`}
                    >
                      {t} ✕
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                <input
                  className={`${FIELD_INPUT} flex-1 min-w-0`}
                  value={tagInput}
                  maxLength={MAX_TAG_LENGTH}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="ADD TAG"
                  aria-label="Add tag"
                />
                <button
                  type="button"
                  className="tx-btn px-3"
                  style={{ minHeight: 44 }}
                  onClick={() => addTag(tagInput)}
                >
                  ADD
                </button>
              </div>
              {unusedSuggestions.length > 0 && (
                <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Suggested tags">
                  {unusedSuggestions.map((t) => (
                    <button
                      key={tagKey(t)}
                      type="button"
                      className="tx-btn shrink-0 px-2 opacity-70"
                      style={{ minHeight: 32, paddingTop: 4, paddingBottom: 4 }}
                      onClick={() => addTag(t)}
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL}>DESCRIPTION · OPTIONAL</span>
              <textarea
                className={`${FIELD_INPUT} resize-none`}
                rows={2}
                value={description}
                maxLength={MAX_DESCRIPTION_LENGTH}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="SHORT DESCRIPTION"
                aria-label="Preset description"
              />
            </label>
          </>
        )}

        {error && (
          <div className="text-[9px] tracking-widest" style={{ color: "var(--tx-red)" }} role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-1 justify-end pt-1">
          <button type="button" className="tx-btn px-3" style={{ minHeight: 44 }} onClick={onCancel}>
            CANCEL
          </button>
          <button
            type="submit"
            className="tx-btn tx-btn-active px-4"
            style={{ minHeight: 44 }}
          >
            {mode === "save" ? "SAVE" : "RENAME"}
          </button>
        </div>
      </form>
    </PatchDialogShell>
  );
}
