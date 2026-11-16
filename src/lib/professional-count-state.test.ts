import { describe, expect, it } from "vitest";
import { getProfessionalCountState } from "./professional-count-state";

describe("professional creation count state", () => {
  it("does not present a price or permit creation while loading or after query failure", () => {
    expect(getProfessionalCountState({ isLoading: true, isError: false, count: 0 })).toMatchObject({
      status: "loading",
      canCreate: false,
      firstProfessionalFree: false,
    });
    expect(getProfessionalCountState({ isLoading: false, isError: true, count: 0 })).toMatchObject({
      status: "error",
      canCreate: false,
      firstProfessionalFree: false,
      atLimit: false,
    });
  });

  it("shows the free first professional only for a valid empty list", () => {
    expect(getProfessionalCountState({ isLoading: false, isError: false, count: 0 })).toMatchObject(
      {
        status: "ready",
        canCreate: true,
        firstProfessionalFree: true,
        atLimit: false,
      },
    );
  });

  it("shows the additional price and applies the limit after a valid count", () => {
    expect(getProfessionalCountState({ isLoading: false, isError: false, count: 1 })).toMatchObject(
      {
        status: "ready",
        canCreate: true,
        firstProfessionalFree: false,
        atLimit: false,
      },
    );
    expect(
      getProfessionalCountState({ isLoading: false, isError: false, count: 10 }),
    ).toMatchObject({
      status: "ready",
      canCreate: false,
      firstProfessionalFree: false,
      atLimit: true,
    });
  });
});
