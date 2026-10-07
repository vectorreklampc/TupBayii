import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TanStackSorguSaglayicisi } from "./tanstack-sorgu-saglayicisi";

function SorguIstemcisiKaniti() {
  const sorguIstemcisi = useQueryClient();

  return <span>{sorguIstemcisi ? "sorgu istemcisi hazir" : ""}</span>;
}

describe("TanStack sorgu saglayicisi", () => {
  it("alt agaca QueryClient sunar", () => {
    render(
      <TanStackSorguSaglayicisi>
        <SorguIstemcisiKaniti />
      </TanStackSorguSaglayicisi>,
    );

    expect(screen.getByText("sorgu istemcisi hazir")).toBeInTheDocument();
  });
});
