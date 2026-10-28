import { describe, expect, it } from "vitest";
import {
  placeComposerSuggestionPanel,
  readComposerSuggestionViewport,
} from "./composer-suggestion-placement";

describe("placeComposerSuggestionPanel", () => {
  const panel = { width: 280, height: 160 };
  const viewport = { width: 390, height: 700, offsetTop: 0, offsetLeft: 0 };

  it("places below the caret when there is room", () => {
    const result = placeComposerSuggestionPanel({
      caret: { top: 100, bottom: 120, left: 40, right: 48 },
      panel,
      viewport,
    });
    expect(result.placement).toBe("below");
    expect(result.top).toBe(126); // bottom + default gap 6
    expect(result.left).toBe(40);
  });

  it("flips above when below does not fit and above has more room", () => {
    const result = placeComposerSuggestionPanel({
      caret: { top: 620, bottom: 640, left: 40, right: 48 },
      panel,
      viewport,
    });
    expect(result.placement).toBe("above");
    expect(result.top).toBe(620 - 6 - 160);
  });

  it("clamps horizontally so the panel stays in the viewport", () => {
    const result = placeComposerSuggestionPanel({
      caret: { top: 100, bottom: 120, left: 350, right: 358 },
      panel,
      viewport,
    });
    // viewRight(390) - margin(8) - width(280) = 102
    expect(result.left).toBe(102);
  });

  it("respects visualViewport offset when the keyboard shrinks the view", () => {
    const result = placeComposerSuggestionPanel({
      caret: { top: 480, bottom: 500, left: 24, right: 32 },
      panel: { width: 280, height: 160 },
      viewport: { width: 390, height: 320, offsetTop: 280, offsetLeft: 0 },
    });
    // Visible band is [280, 600]. Below caret has little room → flip above.
    expect(result.placement).toBe("above");
    expect(result.top).toBeGreaterThanOrEqual(280 + 8);
    expect(result.top + 160).toBeLessThanOrEqual(500);
  });

  it("clamps left to the left margin when caret is near zero", () => {
    const result = placeComposerSuggestionPanel({
      caret: { top: 100, bottom: 120, left: 0, right: 8 },
      panel,
      viewport,
    });
    expect(result.left).toBe(8);
  });
});

describe("readComposerSuggestionViewport", () => {
  it("prefers visualViewport when present", () => {
    const viewport = readComposerSuggestionViewport({
      innerWidth: 1000,
      innerHeight: 800,
      visualViewport: {
        width: 390,
        height: 320,
        offsetTop: 200,
        offsetLeft: 0,
      } as VisualViewport,
    });
    expect(viewport).toEqual({
      width: 390,
      height: 320,
      offsetTop: 200,
      offsetLeft: 0,
    });
  });

  it("falls back to innerWidth/innerHeight", () => {
    const viewport = readComposerSuggestionViewport({
      innerWidth: 1000,
      innerHeight: 800,
      visualViewport: null,
    });
    expect(viewport).toEqual({
      width: 1000,
      height: 800,
      offsetTop: 0,
      offsetLeft: 0,
    });
  });
});
