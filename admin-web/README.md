# Admin Web

Bu workspace, yalnız merkezi SaaS yönetim web uygulamasının composition root'udur. Tenant veya bayi operasyon paneli burada geliştirilmez.

## Teknoloji temeli

- Next.js App Router ve React
- Strict TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query ve TanStack Table
- Vitest ve Testing Library

`src/app/` route ve layout sahipliğini, `src/components/ui/` shadcn/ui bileşenlerini, `src/saglayicilar/` ise uygulama seviyesindeki provider composition'ını barındırır. Business feature klasörleri ihtiyaç doğmadan oluşturulmaz.

## Komutlar

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

## Kapsam ve geri dönüş

Bu iskelet mevcut veri, API contract veya deploy edilen bir önceki Admin Web sürümünü taşımaz. Geçiş eklemelidir; geri dönüş `TBP-17` commit'inin revert edilmesiyle yapılır. Uygulama contract'ı ve gerçek yönetim ekranları kendi Jira işlerinde eklenecektir.

## Resmi kaynaklar

- https://nextjs.org/docs/app/getting-started/installation
- https://ui.shadcn.com/docs/installation/next
- https://tailwindcss.com/docs/installation/framework-guides/nextjs
- https://tanstack.com/query/latest/docs/framework/react/quick-start
- https://tanstack.com/table/latest/docs/installation
