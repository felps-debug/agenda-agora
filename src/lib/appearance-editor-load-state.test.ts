import { describe, expect, it } from "vitest";
import { getAppearanceEditorLoadState } from "./appearance-editor-load-state";

describe("appearance editor load state", () => {
  it("waits for config and profile before exposing editing controls", () => {
    expect(
      getAppearanceEditorLoadState({
        config: { isPending: false, isError: false, hasData: true },
        profile: { isPending: true, isError: false, hasData: false },
      }),
    ).toBe("loading");
  });

  it("shows a recoverable error when profile data failed to load", () => {
    expect(
      getAppearanceEditorLoadState({
        config: { isPending: false, isError: false, hasData: true },
        profile: { isPending: false, isError: true, hasData: false },
      }),
    ).toBe("error");
  });

  it("keeps loaded cached profile data available after a background refetch error", () => {
    expect(
      getAppearanceEditorLoadState({
        config: { isPending: false, isError: false, hasData: true },
        profile: { isPending: false, isError: true, hasData: true },
      }),
    ).toBe("ready");
  });

  it("opens editing when both required datasets are ready", () => {
    expect(
      getAppearanceEditorLoadState({
        config: { isPending: false, isError: false, hasData: true },
        profile: { isPending: false, isError: false, hasData: true },
      }),
    ).toBe("ready");
  });
});
