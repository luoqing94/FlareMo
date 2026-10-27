import { Link2Icon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Memo } from "@/api";
import { useI18n } from "@/i18n";
import type { TagSuggestion } from "@/lib/tag-autocomplete";

/**
 * Stop wheel bubbling only while this list can still scroll in that direction,
 * so the timeline underneath does not steal the gesture mid-list.
 */
function stopWheelWhileScrollable(event: React.WheelEvent<HTMLElement>) {
  const el = event.currentTarget;
  const { scrollTop, scrollHeight, clientHeight } = el;
  const delta = event.deltaY;
  const atTop = scrollTop <= 0;
  const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
  if ((delta < 0 && atTop) || (delta > 0 && atBottom)) return;
  event.stopPropagation();
}

function useDismissOnOutsidePointer(
  visible: boolean,
  onDismiss?: (event: PointerEvent) => void,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible || !onDismissRef.current) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      onDismissRef.current?.(event);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [visible]);

  return rootRef;
}

/**
 * "#tag" autocomplete rows. The list is a plain (non-focusable) overlay: the
 * buttons keep the editor selection on mousedown so the picked tag rewrites
 * the token that opened the list.
 */
export function ComposerTagSuggestions({
  visible,
  suggestions,
  onAccept,
  onDismiss,
}: {
  visible: boolean;
  suggestions: TagSuggestion[];
  onAccept: (name: string) => void;
  onDismiss?: (event: PointerEvent) => void;
}) {
  const { t } = useI18n();
  const rootRef = useDismissOnOutsidePointer(visible, onDismiss);
  if (!visible) return null;
  return (
    <div
      ref={rootRef}
      className="absolute inset-x-4 bottom-14 z-30 flex max-h-44 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-md motion-safe:animate-rise"
      data-testid="composer-tag-suggestions"
    >
      <div className="flex shrink-0 items-center justify-end border-b border-border/40 px-1 py-0.5">
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={t("common.close")}
          data-testid="composer-tag-suggestions-close"
          onPointerDown={(event) => {
            event.preventDefault();
            onDismiss?.(event.nativeEvent);
          }}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain py-1"
        onWheel={stopWheelWhileScrollable}
      >
        {suggestions.map((suggestion) => (
          <button
            className="flex w-full items-center justify-between gap-3 rounded-md px-3.5 py-1.5 text-left text-sm text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground"
            key={suggestion.name}
            type="button"
            onMouseDown={(event) => {
              // Keep editor focus/selection so the rewritten caret lands.
              event.preventDefault();
              onAccept(suggestion.name);
            }}
          >
            <span className="truncate">
              <span className="text-muted-foreground">#</span>
              {suggestion.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {suggestion.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * "[[" wikilink autocomplete rows: the note's first line as the link title,
 * with its date on the right. Same mousedown contract as the tag list.
 */
export function ComposerWikiSuggestions({
  visible,
  suggestions,
  onAccept,
  onDismiss,
}: {
  visible: boolean;
  suggestions: Memo[];
  onAccept: (memo: Memo) => void;
  onDismiss?: (event: PointerEvent) => void;
}) {
  const { t } = useI18n();
  const rootRef = useDismissOnOutsidePointer(visible, onDismiss);
  if (!visible) return null;
  return (
    <div
      ref={rootRef}
      className="absolute inset-x-4 bottom-14 z-30 flex max-h-44 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-md motion-safe:animate-rise"
      data-testid="composer-wikilink-suggestions"
    >
      <div className="flex shrink-0 items-center justify-end border-b border-border/40 px-1 py-0.5">
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={t("common.close")}
          data-testid="composer-wikilink-suggestions-close"
          onPointerDown={(event) => {
            event.preventDefault();
            onDismiss?.(event.nativeEvent);
          }}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div
        className="min-h-0 flex-1 touch-pan-y divide-y divide-border/20 overflow-y-auto overscroll-contain py-1"
        onWheel={stopWheelWhileScrollable}
      >
        {suggestions.map((memo) => {
          const preview = memo.content.split("\n")[0]?.slice(0, 50) || memo.id;
          return (
            <button
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left text-sm text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground"
              key={memo.name}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onAccept(memo);
              }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Link2Icon className="size-3.5 shrink-0 text-primary" />
                <span className="truncate text-xs font-medium text-foreground">
                  {preview}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {(memo.display_time ?? memo.create_time)?.slice(0, 10)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
