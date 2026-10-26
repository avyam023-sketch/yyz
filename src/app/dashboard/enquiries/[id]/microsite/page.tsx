import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { requireAuth } from "@/server/auth";
import { check } from "@/server/action-result";
import { listMatchCandidates } from "@/server/data/catalogue";
import { getLeadForEdit } from "@/server/data/leads";
import { matchProperties, type MatchResult } from "@/lib/domain/matching";
import { formatBudgetRange } from "@/lib/domain/money";
import type { Property } from "@/lib/types";
import { PropertySelector, type SelectableProperty } from "./property-selector";

export const metadata: Metadata = { title: "Select properties" };

type Candidate = Property & { archived: boolean };

function toSelectable(m: MatchResult<Candidate>): SelectableProperty {
  const p = m.property;
  return {
    id: p.id,
    unitReference: p.unitReference,
    configuration: p.configuration,
    developmentName: p.developmentName,
    price: p.price,
    priceOnRequest: p.priceOnRequest,
    currency: p.currency,
    area: p.area,
    areaUnit: p.areaUnit,
    floor: p.floor,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    imagePath: p.imagePaths[0] ?? null,
    hasFloorPlan: Boolean(p.floorPlanPath),
    tier: m.tier,
    budget: m.budget,
    developmentMatch: m.developmentMatch,
    configurationMatch: m.configurationMatch,
    reasons: m.reasons,
  };
}

export default async function SelectPropertiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requireAuth();
  const lead = await getLeadForEdit(ctx, id);
  if (!lead) notFound();

  const [catalogue, activeRow] = await Promise.all([
    listMatchCandidates(ctx),
    ctx.supabase.from("microsites").select("id, intro_message, show_buyer_name, expires_at").eq("lead_id", id).is("revoked_at", null).maybeSingle(),
  ]);
  const candidates: Candidate[] = catalogue.map((p) => ({ ...p, archived: Boolean(p.archivedAt) }));
  const active = check(activeRow);
  const currentIds = active
    ? (check(
        await ctx.supabase.from("microsite_properties").select("property_id").eq("microsite_id", active.id).is("removed_at", null).order("position"),
      ) ?? []).map((r) => r.property_id as string)
    : [];

  const summary = matchProperties(
    {
      developmentId: lead.developmentId,
      configuration: lead.configuration,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      budgetCurrency: lead.budgetCurrency,
    },
    candidates,
  );
  const offered = new Set([...summary.exact, ...summary.close, ...summary.other].map((m) => m.property.id));
  const noLongerAvailable = candidates
    .filter((p) => currentIds.includes(p.id) && !offered.has(p.id))
    .map((p) => `${p.configuration} · ${p.unitReference}`);
  // Currently selected properties that still qualify but fell outside every tier (e.g. a manual pick).
  const manualKeep = candidates
    .filter((p) => currentIds.includes(p.id) && !offered.has(p.id) && p.availabilityStatus === "available" && !p.archivedAt)
    .map((p) => ({
      ...toSelectable({ property: p, tier: "close", budget: "unknown", developmentMatch: p.developmentId === lead.developmentId, configurationMatch: p.configuration === lead.configuration, reasons: ["Previously selected manually"] }),
    }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={{ href: `/dashboard/enquiries/${id}`, label: lead.buyerName }}
        eyebrow={active ? "Update microsite" : "Step 2 of 3"}
        title={active ? "Change the property selection" : "Review matching properties"}
        description={`${lead.buyerName} · ${lead.configuration} in ${lead.developmentName} · Budget ${formatBudgetRange(lead.budgetMin, lead.budgetMax, lead.budgetCurrency)}`}
      />
      <PropertySelector
        leadId={id}
        buyerFirstName={lead.buyerName.trim().split(/\s+/)[0]}
        configuration={lead.configuration}
        developmentName={lead.developmentName}
        budgetLabel={formatBudgetRange(lead.budgetMin, lead.budgetMax, lead.budgetCurrency)}
        exact={summary.exact.map(toSelectable)}
        close={[...summary.close.map(toSelectable), ...manualKeep]}
        other={summary.other.map(toSelectable)}
        unavailableExcluded={summary.unavailableExcluded}
        noLongerAvailable={noLongerAvailable.filter((label) => !manualKeep.some((m) => `${m.configuration} · ${m.unitReference}` === label))}
        initialSelection={active ? currentIds.filter((pid) => offered.has(pid) || manualKeep.some((m) => m.id === pid)) : summary.exact.slice(0, 6).map((m) => m.property.id)}
        existing={active ? { micrositeId: active.id as string, introMessage: (active.intro_message as string) ?? "", showBuyerName: active.show_buyer_name as boolean } : null}
      />
    </div>
  );
}
