import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createSeed } from "@/lib/seed";
import { AgreementCard } from "./AgreementCard";

const seed = createSeed();
const artist = (id: string) => seed.artists.find((a) => a.id === id);

describe("AgreementCard", () => {
  it("shows the extracted split and payout window once read", () => {
    const theo = seed.agreements.find((a) => a.id === "agr_theo")!;
    render(
      <AgreementCard
        agreement={theo}
        artist={artist("art_theo")}
        busy={false}
        onRead={() => {}}
      />,
    );
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("14d")).toBeInTheDocument();
    expect(screen.getByText("read by agent")).toBeInTheDocument();
  });

  it("asks the agent to read an unread agreement", async () => {
    const ines = seed.agreements.find((a) => a.id === "agr_ines")!;
    const onRead = vi.fn();
    render(
      <AgreementCard
        agreement={ines}
        artist={artist("art_ines")}
        busy={false}
        onRead={onRead}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Have the agent read it" }),
    );
    expect(onRead).toHaveBeenCalledOnce();
  });
});
