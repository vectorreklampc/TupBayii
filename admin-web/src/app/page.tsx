import { Boxes, Database, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

const altyapiBilesenleri = [
  {
    baslik: "Uygulama kabuğu",
    aciklama: "Next.js App Router, React ve strict TypeScript temeli.",
    Simge: Boxes,
  },
  {
    baslik: "Sunucu verisi",
    aciklama: "TanStack Query sağlayıcısı ve TanStack Table altyapısı.",
    Simge: Database,
  },
  {
    baslik: "Arayüz sistemi",
    aciklama: "Tailwind CSS ve shadcn/ui bileşen sınırı.",
    Simge: ShieldCheck,
  },
] as const;

export default function AnaSayfa() {
  return (
    <main className="bg-muted/40 min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="border-border border-b pb-6">
          <p className="text-muted-foreground mb-3 font-mono text-xs font-semibold tracking-[0.18em] uppercase">
            TupBayiProje / Merkezi SaaS Yönetimi
          </p>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
                Admin Web platform iskeleti hazır
              </h1>
              <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
                Bu workspace yalnız merkezi SaaS yönetimini barındırır. Bayi ve
                tenant operasyon ekranları bu uygulamanın kapsamı dışındadır.
              </p>
            </div>
            <Button disabled variant="outline">
              Contract entegrasyonu bekleniyor
            </Button>
          </div>
        </header>

        <section aria-labelledby="altyapi-basligi">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="altyapi-basligi" className="text-lg font-semibold">
              Etkin altyapı
            </h2>
            <span className="text-muted-foreground text-sm">TBP-17</span>
          </div>
          <ul className="border-border bg-border grid gap-px overflow-hidden rounded-lg border md:grid-cols-3">
            {altyapiBilesenleri.map(({ baslik, aciklama, Simge }) => (
              <li key={baslik} className="bg-card text-card-foreground p-5">
                <Simge
                  aria-hidden="true"
                  className="text-muted-foreground mb-8 size-5"
                />
                <h3 className="font-medium">{baslik}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {aciklama}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
