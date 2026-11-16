import { describe, expect, it } from "vitest";
import { calendarWeekDays } from "./receivables-calendar";

describe("calendarWeekDays", () => {
  it("returns the seven days in the week containing the selected cursor", () => {
    expect(calendarWeekDays(new Date(2026, 10, 12)).map((date) => date.getDate())).toEqual([
      8, 9, 10, 11, 12, 13, 14,
    ]);
  });

  it("moves with the cursor instead of staying anchored to today", () => {
    const selectedWeek = calendarWeekDays(new Date(2026, 10, 5));
    const currentWeek = calendarWeekDays(new Date(2026, 10, 12));
    expect(selectedWeek[0]?.getDate()).toBe(1);
    expect(currentWeek[0]?.getDate()).toBe(8);
  });
});
