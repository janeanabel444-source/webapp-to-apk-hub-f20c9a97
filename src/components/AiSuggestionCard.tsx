import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * A single AI suggestion presented for review. The developer stays in control:
 * the text is fully editable and nothing is saved until Approve is pressed.
 */
export function AiSuggestionCard({
  title,
  hint,
  value,
  rows = 8,
  busy,
  approved,
  onApprove,
  onRegenerate,
}: {
  title: string;
  hint?: string;
  value: string;
  rows?: number;
  busy?: boolean;
  approved?: boolean;
  onApprove: (edited: string) => void;
  onRegenerate: () => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">{title}</p>
        {approved && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            <Check className="h-3 w-3" /> Approved
          </span>
        )}
      </div>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      <Textarea
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-background text-sm"
        placeholder="The AI suggestion will appear here — edit it freely before approving."
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !text.trim()} onClick={() => onApprove(text)}>
          <Check className="mr-1.5 h-4 w-4" /> Approve
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRegenerate}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Regenerate
        </Button>
      </div>
    </div>
  );
}

/** Chips version for list-style suggestions (tags, keywords, highlights). */
export function AiChipSuggestion({
  title,
  items,
  selected,
  busy,
  approved,
  onToggle,
  onApprove,
  onRegenerate,
}: {
  title: string;
  items: string[];
  selected: string[];
  busy?: boolean;
  approved?: boolean;
  onToggle: (item: string) => void;
  onApprove: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">{title}</p>
        {approved && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            <Check className="h-3 w-3" /> Approved
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <p className="text-xs text-muted-foreground">No suggestions yet.</p>}
        {items.map((t) => {
          const on = selected.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToggle(t)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !items.length} onClick={onApprove}>
          <Check className="mr-1.5 h-4 w-4" /> Approve selected
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRegenerate}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
          Regenerate
        </Button>
      </div>
    </div>
  );
}
