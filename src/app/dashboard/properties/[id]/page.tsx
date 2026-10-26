import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Archive, ArchiveRestore, FileText, Pencil } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/app/page-header";
import { MediaImage } from "@/components/app/media-image";
import { ActionButton } from "@/components/app/action-button";
import { PropertyAvailabilityBadge, SampleBadge } from "@/components/app/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { requireAuth } from "@/server/auth";
import { getProperty } from "@/server/data/catalogue";
import { setPropertyArchived, setPropertyAvailability } from "@/server/actions/catalogue";
import { formatArea, formatCompactPrice, formatFullPrice } from "@/lib/domain/money";
import { PROPERTY_AVAILABILITY, PROPERTY_AVAILABILITY_LABELS, PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/domain/constants";
import { mediaUrl } from "@/lib/media";

export const metadata: Metadata = { title: "Property" };

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const p = await getProperty(ctx, id);
  if (!p) notFound();

  let developmentPlan: { label: string; value: string }[] = [];
  if (!p.paymentPlan) {
    const { data } = await ctx.supabase.from("developments").select("payment_plan").eq("id", p.developmentId).maybeSingle();
    developmentPlan = Array.isArray(data?.payment_plan) ? data.payment_plan : [];
  }
  const plan = p.paymentPlan ?? developmentPlan;
  const floorPlanUrl = mediaUrl(p.floorPlanPath);

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/properties", label: "Properties" }}
        eyebrow={<Link href={`/dashboard/developments/${p.developmentId}`} className="hover:underline">{p.developmentName}</Link>}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {p.configuration} · Unit {p.unitReference}
            {p.isSample && <SampleBadge />}
          </span>
        }
        actions={
          <>
            <PropertyAvailabilityBadge status={p.availabilityStatus} archived={Boolean(p.archivedAt)} />
            <Link href={`/dashboard/properties/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden /> Edit
            </Link>
            {p.archivedAt ? (
              <ActionButton variant="outline" action={setPropertyArchived.bind(null, id, false)}>
                <ArchiveRestore aria-hidden /> Restore
              </ActionButton>
            ) : (
              <ActionButton
                variant="outline"
                action={setPropertyArchived.bind(null, id, true)}
                confirm={{
                  title: `Archive unit ${p.unitReference}?`,
                  description: "It will not be suggested for new enquiries, and existing microsites will show it as unavailable without a price.",
                  confirmLabel: "Archive property",
                  destructive: true,
                }}
              >
                <Archive aria-hidden /> Archive
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <MediaImage path={p.imagePaths[0]} alt={`Unit ${p.unitReference}`} className="aspect-[16/9] rounded-xl" priority label="No photos uploaded" />
          {p.imagePaths.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {p.imagePaths.slice(1).map((path) => (
                <MediaImage key={path} path={path} alt={`Unit ${p.unitReference}`} className="aspect-square rounded-lg" sizes="160px" />
              ))}
            </div>
          )}
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Description" />
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.description ?? "No description yet."}</p>
            {p.features.length > 0 && (
              <ul className="mt-5 grid gap-1.5 text-sm sm:grid-cols-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-2 size-1 rounded-full bg-brass" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Floor plan" />
            {floorPlanUrl ? (
              p.floorPlanPath?.endsWith(".pdf") ? (
                <a href={floorPlanUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                  <FileText aria-hidden /> Open floor plan (PDF)
                </a>
              ) : (
                <MediaImage path={p.floorPlanPath} alt={`Floor plan for unit ${p.unitReference}`} className="aspect-[4/3] rounded-lg bg-white [&_img]:object-contain" />
              )
            ) : (
              <p className="text-sm text-muted-foreground">No floor plan uploaded. Buyers will see “Floor plan available on request”.</p>
            )}
          </section>
        </div>
        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="font-display text-4xl font-semibold">{formatCompactPrice(p.price, p.currency)}</div>
            {p.price !== null && <div className="text-xs text-muted-foreground">{formatFullPrice(p.price, p.currency)}</div>}
            {p.priceOnRequest && <div className="mt-1 text-xs font-medium text-brass">Buyers see &ldquo;Price on request&rdquo;</div>}
            <dl className="mt-5 space-y-2 text-sm">
              {[
                ["Type", PROPERTY_TYPE_LABELS[p.propertyType as PropertyType] ?? p.propertyType],
                ["Bedrooms", p.bedrooms ?? "—"],
                ["Bathrooms", p.bathrooms ?? "—"],
                ["Area", formatArea(p.area, p.areaUnit)],
                ["Floor", p.floor ?? "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Quick availability" description="Changes appear on microsites immediately." />
            <div className="flex flex-wrap gap-2">
              {PROPERTY_AVAILABILITY.map((s) => (
                <ActionButton key={s} size="sm" variant={p.availabilityStatus === s ? "default" : "outline"} disabled={p.availabilityStatus === s} action={setPropertyAvailability.bind(null, id, s)}>
                  {PROPERTY_AVAILABILITY_LABELS[s]}
                </ActionButton>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-6">
            <SectionHeading title="Payment plan" description={p.paymentPlan ? "Specific to this unit" : "From the development"} />
            {plan.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment plan set.</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {plan.map((m) => (
                  <div key={m.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{m.label}</dt>
                    <dd className="font-medium">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
