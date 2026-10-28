import type { Editor } from "@tiptap/react";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";
import {
  placeComposerSuggestionPanel,
  readComposerSuggestionViewport,
} from "@/lib/composer-suggestion-placement";

/** Default panel size before the first layout measure (max-h-44 ≈ 11rem). */
const FALLBACK_PANEL = { width: 320, height: 176 };

/**
 * Fixed-position style for a caret-anchored suggestion panel.
 *
 * Recomputes while open on editor transactions, scroll (capture), resize, and
 * visualViewport changes so mobile keyboards and timeline scrolls stay aligned.
 */
export function useCaretAnchoredSuggestionStyle({
  visible,
  editorRef,
  anchorPos,
  panelRef,
}: {
  visible: boolean;
  editorRef: RefObject<Editor | null>;
  /** Document position of the token start (`#` / `[[`). */
  anchorPos: number | null;
  panelRef: RefObject<HTMLElement | null>;
}): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(() => ({
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 60,
    visibility: "hidden",
    width: "min(22rem, calc(100vw - 1rem))",
    maxWidth: "calc(100vw - 1rem)",
  }));

  const recompute = useCallback(() => {
    if (!visible || anchorPos == null) return;
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const { doc } = editor.state;
    if (anchorPos < 0 || anchorPos > doc.content.size) return;

    let caret: { top: number; bottom: number; left: number; right: number };
    try {
      caret = editor.view.coordsAtPos(anchorPos);
    } catch {
      return;
    }

    const el = panelRef.current;
    const panel = el
      ? {
          width: Math.max(el.offsetWidth, 1),
          height: Math.max(el.offsetHeight, 1),
        }
      : FALLBACK_PANEL;

    const placed = placeComposerSuggestionPanel({
      caret,
      panel,
      viewport: readComposerSuggestionViewport(),
    });

    setStyle({
      position: "fixed",
      top: placed.top,
      left: placed.left,
      zIndex: 60,
      visibility: "visible",
      width: "min(22rem, calc(100vw - 1rem))",
      maxWidth: "calc(100vw - 1rem)",
    });
  }, [visible, editorRef, anchorPos, panelRef]);

  useLayoutEffect(() => {
    if (!visible || anchorPos == null) {
      setStyle((prev) =>
        prev.visibility === "hidden"
          ? prev
          : {
              ...prev,
              visibility: "hidden",
            },
      );
      return;
    }

    recompute();

    const editor = editorRef.current;
    const onEditorUpdate = () => {
      recompute();
    };
    editor?.on("transaction", onEditorUpdate);

    const onScrollOrResize = () => {
      recompute();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onScrollOrResize);
    vv?.addEventListener("scroll", onScrollOrResize);

    const el = panelRef.current;
    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        recompute();
      });
      ro.observe(el);
    }

    return () => {
      editor?.off("transaction", onEditorUpdate);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      vv?.removeEventListener("resize", onScrollOrResize);
      vv?.removeEventListener("scroll", onScrollOrResize);
      ro?.disconnect();
    };
  }, [visible, anchorPos, editorRef, panelRef, recompute]);

  return style;
}
