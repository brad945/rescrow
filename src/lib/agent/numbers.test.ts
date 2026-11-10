import { describe, expect, it } from "vitest";
import { numbersIn, states } from "./numbers";

describe("numbersIn", () => {
  it.each([
    ["Gallery retains fifty percent (50%)", [50]],
    ["within sixty (60) days", [60]],
    ["the Gallery keeps half and the Artist keeps half", [50]],
    ["forty-five days after receipt", [45]],
    ["seventy five percent", [75]],
    ["two thirds of the net price", [66.67]],
    ["one third", [33.33]],
    ["proceeds will be divided equally between the Gallery and you", [50]],
    ["split evenly", [50]],
    ["no later than fourteen (14) days", [14]],
  ])("reads %j", (text, expected) => {
    for (const n of expected) expect(states(text, n)).toBe(true);
  });

  it("finds nothing in a clause with no numbers", () => {
    expect(numbersIn("All sums owed to the Artist are held in trust")).toEqual(
      [],
    );
  });

  it("does not confuse sixty with six", () => {
    expect(states("sixty days", 6)).toBe(false);
    expect(states("sixty days", 60)).toBe(true);
  });
});
