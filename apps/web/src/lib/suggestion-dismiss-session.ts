/**
 * Dismiss-session rules for composer "#" / "[[" suggestion panels.
 *
 * After the author closes the panel (× or click-outside), keep it closed for
 * the same in-progress token even while they add/delete characters. Ending the
 * token (space/newline/caret leave → null) or starting a different `#`/`[[`
 * clears the dismiss. A selection-only move back into that same token (click /
 * arrow) reopens the matching suggestions — the tag acts like a button.
 */

export type SuggestionDismissMeta = {
  /** False when only the selection moved (click/arrow into the token). */
  docChanged: boolean;
  /**
   * Pointer that triggered this notify. Used to ignore the same gesture that
   * just dismissed the panel so it does not immediately reopen.
   */
  pointerId?: number;
};

/**
 * Next dismissed `from`, given the previous dismiss anchor and the latest
 * token under the caret.
 */
export function nextSuggestionDismissFrom(
  dismissedFrom: number | null,
  tokenFrom: number | null,
  meta?: SuggestionDismissMeta,
): number | null {
  if (tokenFrom === null) return null;
  if (dismissedFrom === null) return null;
  if (tokenFrom !== dismissedFrom) return null;
  if (meta && meta.docChanged === false) return null;
  return dismissedFrom;
}

/** Whether the suggestion panel should render for the active token. */
export function shouldShowComposerSuggestions(options: {
  hasSuggestions: boolean;
  isPending: boolean;
  tokenFrom: number | null;
  dismissedFrom: number | null;
}): boolean {
  const { hasSuggestions, isPending, tokenFrom, dismissedFrom } = options;
  if (!hasSuggestions || isPending || tokenFrom === null) return false;
  return dismissedFrom !== tokenFrom;
}
