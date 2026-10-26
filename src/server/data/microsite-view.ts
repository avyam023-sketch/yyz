import "server-only";
import type { AuthContext } from "@/server/auth";
import type { MicrositeState, PublicMicrosite, PublicMicrositeResult, PublicProperty } from "@/lib/types";
import { createPublicClient } from "@/lib/supabase/server";
import { isWellFormedToken } from "@/lib/security/tokens";
import { check } from "@/server/action-result";
import { mapDevelopment, mapProperty, micrositeState } from "./mappers";

/** Buyer-facing lookup. Goes through the anon-only RPC, never table access. */
export async function getPublicMicrosite(token: string): Promise<PublicMicrositeResult> {
  if (!isWellFormedToken(token)) return { status: "not_found" };
  const { data, error } = await createPublicClient().rpc("get_public_microsite", { p_token: token });
  if (error) {
    console.error("[microsite] lookup failed", { code: error.code });
    throw new Error("Microsite lookup failed");
  }
  return data as PublicMicrositeResult;
}

/**
 * The same shape as the public RPC, built from authenticated queries so an
 * agent can preview a microsite (even a revoked one) without the raw token
 * and without recording any buyer engagement.
 */
export async function getMicrositePreview(
  ctx: AuthContext,
  micrositeId: string,
): Promise<{ site: PublicMicrosite; state: MicrositeState; leadId: string; buyerName: string } | null> {
  const sb = ctx.supabase;
  const ms = check(await sb.from("microsites").select("*").eq("organisation_id", ctx.organisation.id).eq("id", micrositeId).maybeSingle());
  if (!ms) return null;

  const lead = check(await sb.from("leads").select("*").eq("id", ms.lead_id).maybeSingle());
  if (!lead) return null;
  const [devRow, brochureRow, selection, agentProfile] = await Promise.all([
    sb.from("developments").select("*").eq("id", lead.development_id).maybeSingle(),
    sb.from("brochure_assets").select("title, storage_path, allow_download").eq("development_id", lead.development_id).is("archived_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("microsite_properties").select("property_id, public_ref, position").eq("microsite_id", micrositeId).is("removed_at", null).order("position"),
    sb.from("profiles").select("full_name, phone_e164").eq("id", lead.assigned_agent_id ?? lead.created_by ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
  ]);
  const development = mapDevelopment(check(devRow));
  const selectionRows = check(selection) ?? [];
  const propertyIds = selectionRows.map((s) => s.property_id as string);
  const propertyRows = propertyIds.length ? check(await sb.from("properties").select("*").in("id", propertyIds)) ?? [] : [];
  const devIds = Array.from(new Set(propertyRows.map((p) => p.development_id as string)));
  const propertyDevs = devIds.length ? check(await sb.from("developments").select("id, name, payment_plan").in("id", devIds)) ?? [] : [];

  const properties: PublicProperty[] = selectionRows
    .map((s) => {
      const row = propertyRows.find((p) => p.id === s.property_id);
      if (!row) return null;
      const dev = propertyDevs.find((d) => d.id === row.development_id);
      const p = mapProperty(row, dev?.name ?? "");
      const available = !p.archivedAt && p.availabilityStatus === "available";
      return {
        ref: s.public_ref as string,
        developmentName: p.developmentName,
        unitReference: p.unitReference,
        configuration: p.configuration,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        areaUnit: p.areaUnit,
        availabilityStatus: p.archivedAt ? "unavailable" : p.availabilityStatus,
        price: available && !p.priceOnRequest ? p.price : null,
        priceOnRequest: p.priceOnRequest,
        currency: p.currency,
        floor: p.floor,
        floorPlanPath: p.floorPlanPath,
        imagePaths: p.imagePaths,
        description: p.description,
        features: p.features,
        paymentPlan: p.paymentPlan ?? (Array.isArray(dev?.payment_plan) ? dev.payment_plan : null),
      } satisfies PublicProperty;
    })
    .filter((p): p is PublicProperty => p !== null);

  const agent = check(agentProfile);
  const brochure = check(brochureRow);
  const site: PublicMicrosite = {
    status: "active",
    organisationName: ctx.organisation.name,
    buyerFirstName: ms.show_buyer_name ? (lead.buyer_name as string).trim().split(/\s+/)[0] : null,
    configuration: lead.configuration,
    introMessage: ms.intro_message,
    expiresAt: ms.expires_at,
    agent: { name: agent?.full_name ?? development.contactName, phone: agent?.phone_e164 ?? development.contactPhone },
    development: {
      name: development.name,
      developerName: development.developerName,
      description: development.description,
      location: development.location,
      address: development.address,
      mapUrl: development.mapUrl,
      latitude: development.latitude,
      longitude: development.longitude,
      coverImagePath: development.coverImagePath,
      coverImageMobilePath: development.coverImageMobilePath,
      galleryPaths: development.galleryPaths,
      amenities: development.amenities,
      paymentPlan: development.paymentPlan,
      paymentPlanNotes: development.paymentPlanNotes,
      contactName: development.contactName,
      contactPhone: development.contactPhone,
      contactEmail: development.contactEmail,
    },
    brochure: brochure ? { title: brochure.title, path: brochure.storage_path, allowDownload: brochure.allow_download } : null,
    properties,
  };

  return { site, state: micrositeState(ms), leadId: lead.id, buyerName: lead.buyer_name };
}
