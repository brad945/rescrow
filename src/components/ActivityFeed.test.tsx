import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/seed";
import { ActivityFeed } from "./ActivityFeed";

describe("ActivityFeed", () => {
  it("shows only the chosen artist's events", () => {
    render(<ActivityFeed snapshot={createSeed()} artistId="art_mara" />);
    expect(
      screen.getByText("Paid Mara Okafor $9,000.00 for Tidewater, Evening"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Theo Lindqvist/)).not.toBeInTheDocument();
  });

  it("caps the list at the limit, newest first", () => {
    render(<ActivityFeed snapshot={createSeed()} limit={1} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/Locked \$2,400\.00 for Theo/);
  });

  it("says so when there is nothing to show", () => {
    render(<ActivityFeed snapshot={createSeed()} artistId="art_nobody" />);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });
});
