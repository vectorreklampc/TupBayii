import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AnaSayfa from "./page";

describe("merkezi SaaS admin iskeleti", () => {
  it("merkezi yonetim sinirini ve teknoloji temelini gosterir", () => {
    render(<AnaSayfa />);

    expect(
      screen.getByRole("heading", {
        name: "Admin Web platform iskeleti hazır",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/tenant operasyon ekranları/i)).toBeInTheDocument();
    expect(screen.getByText(/TanStack Query/i)).toBeInTheDocument();
    expect(screen.getByText(/Tailwind CSS/i)).toBeInTheDocument();
  });
});
