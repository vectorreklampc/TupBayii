// @vitest-environment node

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SystemApi } from "./uretilen/apis/SystemApi";
import { SistemSaglikStatusEnum } from "./uretilen/models/SistemSaglik";
import { Configuration } from "./uretilen/runtime";

async function uygunPortBul(): Promise<number> {
  const sunucu = createServer();
  await new Promise<void>((tamamlandi) =>
    sunucu.listen(0, "127.0.0.1", tamamlandi),
  );
  const adres = sunucu.address();
  if (typeof adres !== "object" || !adres) {
    throw new Error("Gecici mock server portu belirlenemedi.");
  }
  const port = adres.port;
  await new Promise<void>((tamamlandi, reddet) =>
    sunucu.close((hata) => (hata ? reddet(hata) : tamamlandi())),
  );
  return port;
}

async function mockSunucusunuBekle(
  surec: ChildProcessWithoutNullStreams,
): Promise<void> {
  await new Promise<void>((tamamlandi, reddet) => {
    let ciktiTamponu = "";
    const zamanAsimi = setTimeout(
      () => reddet(new Error("Kanonik mock server zamaninda baslamadi.")),
      10_000,
    );
    const cikis = (kod: number | null) =>
      reddet(new Error(`Kanonik mock server erken kapandi: ${kod}`));
    const cikti = (veri: Buffer) => {
      ciktiTamponu += veri.toString();
      if (ciktiTamponu.includes("adresinde hazir")) {
        clearTimeout(zamanAsimi);
        surec.off("exit", cikis);
        surec.stdout.off("data", cikti);
        tamamlandi();
      }
    };

    surec.once("exit", cikis);
    surec.stdout.on("data", cikti);
  });
}

describe("OpenAPI generated Admin Web client mock entegrasyonu", () => {
  it("kanonik saglik operasyonunu generated client ile typed cagirir", async () => {
    const depoKoku = resolve(process.cwd(), "..");
    const port = await uygunPortBul();
    const mockSureci = spawn(
      process.execPath,
      [resolve(depoKoku, "contracts/scripts/mock-server.mjs")],
      {
        cwd: depoKoku,
        env: {
          ...process.env,
          MOCK_HOST: "127.0.0.1",
          MOCK_PORT: String(port),
        },
      },
    );
    let hataCiktisi = "";
    mockSureci.stderr.on("data", (veri: Buffer) => {
      hataCiktisi += veri.toString();
    });

    try {
      await mockSunucusunuBekle(mockSureci);

      const api = new SystemApi(
        new Configuration({ basePath: `http://127.0.0.1:${port}` }),
      );
      const yanit = await api.getSystemHealthRaw();
      const saglik = await yanit.value();

      expect(yanit.raw.status).toBe(200);
      expect(saglik.status).toBe(SistemSaglikStatusEnum.Ok);
      expect(saglik.service).toBe("tup-bayi-api");
      expect(saglik.apiVersion).toBe("v1");
      expect(saglik.timestampUtc).toEqual(new Date("2026-10-07T00:00:00Z"));
      expect(yanit.raw.headers.get("TraceId")).toBe(saglik.traceId);
    } finally {
      if (mockSureci.exitCode === null) {
        mockSureci.kill();
        await new Promise<void>((tamamlandi) =>
          mockSureci.once("exit", () => tamamlandi()),
        );
      }
      if (hataCiktisi) process.stderr.write(hataCiktisi);
    }
  });
});
