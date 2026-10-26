"use client";

import { useEffect, useRef, useState } from "react";
import { BedDouble, Bath, Building, FileText, LayoutPanelTop, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MediaImage } from "@/components/app/media-image";
import { formatArea, formatCompactPrice, formatFullPrice } from "@/lib/domain/money";
import { PROPERTY_AVAILABILITY_LABELS, PROPERTY_TYPE_LABELS, type PropertyAvailability, type PropertyType } from "@/lib/domain/constants";
import { residenceHeadline, residenceName } from "@/lib/domain/residence";
import { mediaUrl } from "@/lib/media";
import type { PublicProperty } from "@/lib/types";
import { useTracker } from "./tracker";

function Fact({ icon: Icon, children }: { icon: typeof BedDouble; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-brass" aria-hidden />
      {children}
    </span>
  );
}

export function PropertyCard({ p, onRequestViewing, showDevelopment }: { p: PublicProperty; onRequestViewing: (ref: string) => void; showDevelopment: boolean }) {
  const { track } = useTracker();
  const ref = useRef<HTMLElement>(null);
  const [details, setDetails] = useState(false);
  const [floorPlan, setFloorPlan] = useState(false);
  const available = p.availabilityStatus === "available";
  const floorPlanUrl = mediaUrl(p.floorPlanPath);
  const floorPlanIsPdf = p.floorPlanPath?.endsWith(".pdf");

  // "Viewed" means at least half the card was on screen for a second.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            track("property_viewed", { propertyRef: p.ref });
            observer.disconnect();
          }, 1000);
        } else if (timer) {
          clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [p.ref, track]);

  const title = residenceName(p.propertyType, p.unitReference);
  const headline = residenceHeadline(p.features);
  const showPrice = available && !p.priceOnRequest && p.price !== null;

  return (
    <article ref={ref} className="group flex flex-col overflow-hidden rounded-2xl border border-[#e6e0d4] bg-white shadow-[0_1px_2px_rgba(18,22,20,0.04)]">
      <div className="relative">
        <MediaImage path={p.imagePaths[0]} alt={title} className="aspect-[4/3]" sizes="(max-width: 768px) 100vw, 50vw" label="Photography coming soon" />
        {!available && (
          <span className="absolute top-3 left-3 rounded-full bg-charcoal/85 px-3 py-1 text-xs font-medium text-ivory">
            {PROPERTY_AVAILABILITY_LABELS[p.availabilityStatus as PropertyAvailability] ?? "Unavailable"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {showDevelopment && <div className="eyebrow mb-1 text-brass">{p.developmentName}</div>}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-2xl leading-tight font-semibold text-charcoal">{title}</h3>
            {headline && <p className="mt-1 line-clamp-2 text-sm text-charcoal/75">{headline}</p>}
          </div>
          <div className="shrink-0 pt-1 text-right">
            {showPrice ? (
              <div className="font-display text-2xl leading-none font-semibold text-charcoal">{formatCompactPrice(p.price, p.currency)}</div>
            ) : available ? (
              <div className="eyebrow max-w-[6.5rem] leading-snug text-brass sm:max-w-none">Price on request</div>
            ) : (
              <div className="text-sm text-muted-foreground">No longer available</div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[#efe9dd] pt-3 text-xs text-charcoal/65">
          <span className="font-medium text-charcoal/80">{p.configuration}</span>
          {p.area !== null && <Fact icon={Maximize2}>{formatArea(p.area, p.areaUnit)}</Fact>}
          {p.bedrooms !== null && <Fact icon={BedDouble}>{p.bedrooms} bed</Fact>}
          {p.bathrooms !== null && <Fact icon={Bath}>{p.bathrooms} bath</Fact>}
          {p.floor !== null && <Fact icon={Building}>Floor {p.floor}</Fact>}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => {
              setDetails(true);
              track("property_details_opened", { propertyRef: p.ref });
            }}
          >
            View details
          </Button>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => {
              setFloorPlan(true);
              track("floor_plan_opened", { propertyRef: p.ref });
            }}
          >
            <LayoutPanelTop aria-hidden /> Floor plan
          </Button>
          {available && (
            <Button className="col-span-2 h-10" onClick={() => onRequestViewing(p.ref)}>
              Request a viewing of this home
            </Button>
          )}
        </div>
      </div>

      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
            <DialogDescription>
              {p.configuration} {(PROPERTY_TYPE_LABELS[p.propertyType as PropertyType] ?? "home").toLowerCase()} in {p.developmentName}
              {showPrice ? ` · ${formatFullPrice(p.price, p.currency)}` : available ? " · Price on request" : ""}
            </DialogDescription>
          </DialogHeader>
          {p.imagePaths.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {p.imagePaths.slice(0, 6).map((path, i) => (
                <MediaImage key={path} path={path} alt={`${title}, photo ${i + 1}`} className={i === 0 ? "col-span-2 aspect-[16/9] rounded-lg" : "aspect-[4/3] rounded-lg"} sizes="(max-width: 640px) 100vw, 640px" />
              ))}
            </div>
          )}
          {p.description && <p className="text-sm leading-relaxed whitespace-pre-wrap text-charcoal/85">{p.description}</p>}
          {p.features.length > 0 && (
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-brass" aria-hidden /> {f}
                </li>
              ))}
            </ul>
          )}
          {p.paymentPlan && p.paymentPlan.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold">Payment plan</div>
              <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                {p.paymentPlan.map((m) => (
                  <div key={m.label} className="flex justify-between gap-4 px-3 py-2">
                    <dt className="text-muted-foreground">{m.label}</dt>
                    <dd className="font-medium">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {available && (
            <Button
              size="lg"
              onClick={() => {
                setDetails(false);
                onRequestViewing(p.ref);
              }}
            >
              Request a viewing of this home
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={floorPlan} onOpenChange={setFloorPlan}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Floor plan · {title}</DialogTitle>
            <DialogDescription>Indicative layout. Dimensions may vary slightly on completion.</DialogDescription>
          </DialogHeader>
          {floorPlanUrl ? (
            floorPlanIsPdf ? (
              <a href={floorPlanUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-brand underline">
                <FileText className="size-4" aria-hidden /> Open the floor plan (PDF)
              </a>
            ) : (
              <MediaImage path={p.floorPlanPath} alt={`Floor plan for ${title}`} className="aspect-[4/3] rounded-lg bg-white [&_img]:object-contain" sizes="(max-width: 768px) 100vw, 768px" />
            )
          ) : (
            <p className="rounded-lg bg-muted/60 p-6 text-center text-sm text-muted-foreground">The floor plan for this home is available on request from your property contact.</p>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
