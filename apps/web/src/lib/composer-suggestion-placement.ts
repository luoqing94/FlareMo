/**
 * Pure placement for composer "#" / "[[" suggestion panels.
 *
 * Prefer opening below the caret; flip above when the visible viewport (usually
 * `visualViewport`) does not have enough room. Clamp horizontally so the panel
 * stays inside the viewport margins. Coordinates are CSS pixels in the same
 * space as `position: fixed` + TipTap `view.coordsAtPos` (layout viewport),
 * with optional visualViewport offsets for keyboard-resized mobile browsers.
 */

export type RectLike = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type SizeLike = {
  width: number;
  height: number;
};

export type ViewportLike = {
  /** Visible width (`visualViewport.width` or `innerWidth`). */
  width: number;
  /** Visible height (`visualViewport.height` or `innerHeight`). */
  height: number;
  /** `visualViewport.offsetTop` when the layout viewport is scrolled/offset. */
  offsetTop?: number;
  /** `visualViewport.offsetLeft` when the layout viewport is scrolled/offset. */
  offsetLeft?: number;
};

export type PlacementResult = {
  top: number;
  left: number;
  placement: "below" | "above";
};

export const COMPOSER_SUGGESTION_DEFAULT_GAP = 6;
export const COMPOSER_SUGGESTION_DEFAULT_MARGIN = 8;

/**
 * Compute fixed `top`/`left` for a suggestion panel relative to a caret rect.
 */
export function placeComposerSuggestionPanel(options: {
  caret: RectLike;
  panel: SizeLike;
  viewport: ViewportLike;
  gap?: number;
  margin?: number;
}): PlacementResult {
  const gap = options.gap ?? COMPOSER_SUGGESTION_DEFAULT_GAP;
  const margin = options.margin ?? COMPOSER_SUGGESTION_DEFAULT_MARGIN;
  const offsetTop = options.viewport.offsetTop ?? 0;
  const offsetLeft = options.viewport.offsetLeft ?? 0;
  const viewTop = offsetTop;
  const viewBottom = offsetTop + options.viewport.height;
  const viewLeft = offsetLeft;
  const viewRight = offsetLeft + options.viewport.width;

  const panelHeight = Math.max(0, options.panel.height);
  const panelWidth = Math.max(0, options.panel.width);

  const spaceBelow = viewBottom - options.caret.bottom - gap - margin;
  const spaceAbove = options.caret.top - gap - margin - viewTop;
  const preferBelow =
    spaceBelow >= panelHeight || spaceBelow >= spaceAbove;

  let placement: "below" | "above";
  let top: number;
  if (preferBelow) {
    placement = "below";
    top = options.caret.bottom + gap;
    const maxTop = viewBottom - margin - panelHeight;
    if (top > maxTop) top = Math.max(viewTop + margin, maxTop);
  } else {
    placement = "above";
    top = options.caret.top - gap - panelHeight;
    if (top < viewTop + margin) top = viewTop + margin;
  }

  let left = options.caret.left;
  const maxLeft = viewRight - margin - panelWidth;
  const minLeft = viewLeft + margin;
  if (left > maxLeft) left = Math.max(minLeft, maxLeft);
  if (left < minLeft) left = minLeft;

  return { top, left, placement };
}

/** Snapshot the visible viewport for placement (keyboard-safe when available). */
export function readComposerSuggestionViewport(
  win: Pick<Window, "innerWidth" | "innerHeight" | "visualViewport"> = window,
): ViewportLike {
  const vv = win.visualViewport;
  if (vv) {
    return {
      width: vv.width,
      height: vv.height,
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
    };
  }
  return {
    width: win.innerWidth,
    height: win.innerHeight,
    offsetTop: 0,
    offsetLeft: 0,
  };
}
