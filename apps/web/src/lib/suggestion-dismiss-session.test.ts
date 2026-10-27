import { describe, expect, it } from "vitest";
import {
  nextSuggestionDismissFrom,
  shouldShowComposerSuggestions,
} from "./suggestion-dismiss-session";

describe("nextSuggestionDismissFrom", () => {
  it("clears when the caret leaves the token", () => {
    expect(nextSuggestionDismissFrom(3, null)).toBeNull();
  });

  it("stays dismissed while typing inside the same token session", () => {
    expect(nextSuggestionDismissFrom(3, 3, { docChanged: true })).toBe(3);
  });

  it("reopens on a selection-only return into the same token", () => {
    expect(nextSuggestionDismissFrom(3, 3, { docChanged: false })).toBeNull();
  });

  it("clears when a different token starts", () => {
    expect(nextSuggestionDismissFrom(3, 10, { docChanged: true })).toBeNull();
  });

  it("stays open when nothing was dismissed", () => {
    expect(nextSuggestionDismissFrom(null, 3, { docChanged: true })).toBeNull();
  });
});

describe("shouldShowComposerSuggestions", () => {
  it("hides while the active token is dismissed", () => {
    expect(
      shouldShowComposerSuggestions({
        hasSuggestions: true,
        isPending: false,
        tokenFrom: 3,
        dismissedFrom: 3,
      }),
    ).toBe(false);
  });

  it("shows when the token is not dismissed", () => {
    expect(
      shouldShowComposerSuggestions({
        hasSuggestions: true,
        isPending: false,
        tokenFrom: 3,
        dismissedFrom: null,
      }),
    ).toBe(true);
  });
});
