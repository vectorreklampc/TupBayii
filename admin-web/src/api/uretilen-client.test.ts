import { describe, expect, it } from "vitest";

import { HataFromJSON } from "./uretilen/models/Hata";

describe("OpenAPI generated Admin Web client", () => {
  it("kanonik hata modelini typed istemci modeline donusturur", () => {
    const hata = HataFromJSON({
      code: "DOGRULAMA_HATASI",
      message: "Istek dogrulanamadi",
      traceId: "trace-123",
      details: [{ field: "telefon", code: "GECERSIZ_FORMAT" }],
    });

    expect(hata).toEqual({
      code: "DOGRULAMA_HATASI",
      message: "Istek dogrulanamadi",
      traceId: "trace-123",
      details: [{ field: "telefon", code: "GECERSIZ_FORMAT" }],
    });
  });
});
