import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { requireAuth } from "@/server/auth";
import { developmentOptions, getProperty } from "@/server/data/catalogue";
import { PropertyForm } from "../../property-form";

export const metadata: Metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const [p, developments] = await Promise.all([getProperty(ctx, id), developmentOptions(ctx)]);
  if (!p) notFound();
  const devs = developments.some((d) => d.id === p.developmentId) ? developments : [...developments, { id: p.developmentId, name: `${p.developmentName} (archived)` }];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={{ href: `/dashboard/properties/${id}`, label: `Unit ${p.unitReference}` }} title="Edit property" />
      <PropertyForm
        id={id}
        developments={devs}
        mediaPrefix={ctx.organisation.mediaPrefix}
        defaultCurrency={ctx.organisation.defaultCurrency}
        defaults={{
          developmentId: p.developmentId,
          unitReference: p.unitReference,
          configuration: p.configuration as never,
          propertyType: p.propertyType as never,
          bedrooms: p.bedrooms !== null ? String(p.bedrooms) : "",
          bathrooms: p.bathrooms !== null ? String(p.bathrooms) : "",
          area: p.area !== null ? String(p.area) : "",
          areaUnit: p.areaUnit as never,
          price: p.price !== null ? String(p.price) : "",
          priceOnRequest: p.priceOnRequest,
          currency: p.currency,
          floor: p.floor !== null ? String(p.floor) : "",
          description: p.description ?? "",
          features: p.features.join("\n"),
          availabilityStatus: p.availabilityStatus as never,
          usesDevelopmentPaymentPlan: p.paymentPlan === null,
          paymentPlan: p.paymentPlan ?? [],
          floorPlanPath: p.floorPlanPath ?? "",
          imagePaths: p.imagePaths,
        }}
      />
    </div>
  );
}
