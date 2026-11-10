import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSeed } from "@/lib/seed";
import { GalleryBalances } from "./GalleryAccount";

describe("GalleryBalances", () => {
  it("without onExplain (as /present and /demo use it), no balance is a button", () => {
    render(<GalleryBalances snapshot={createSeed()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("with onExplain (as /gallery uses it), the balances open their records", () => {
    const onExplain = vi.fn();
    render(<GalleryBalances snapshot={createSeed()} onExplain={onExplain} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onExplain.mock.calls.map((c) => c[0])).toEqual([
      "operating",
      "trust",
    ]);
  });
});
