import "server-only";
import type { Brochure, Development, Lead, Microsite, MicrositeState, PaymentMilestone, Property } from "@/lib/types";
import { isLeadStatus } from "@/lib/domain/lead-status";

/* Supabase rows are untyped here (no generated Database types yet), so each
   mapper is the single place where a row's shape is trusted. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const plan = (v: unknown): PaymentMilestone[] =>
  Array.isArray(v) ? v.filter((m) => m && typeof m.label === "string" && typeof m.value === "string") : [];

export function mapDevelopment(r: Row): Development {
  return {
    id: r.id,
    name: r.name,
    developerName: r.developer_name,
    description: r.description,
    location: r.location,
    address: r.address,
    mapUrl: r.map_url,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    coverImagePath: r.cover_image_path,
    coverImageMobilePath: r.cover_image_mobile_path ?? null,
    galleryPaths: r.gallery_paths ?? [],
    amenities: r.amenities ?? [],
    paymentPlan: plan(r.payment_plan),
    paymentPlanNotes: r.payment_plan_notes,
    contactName: r.contact_name,
    contactPhone: r.contact_phone_e164,
    contactEmail: r.contact_email,
    availabilityStatus: r.availability_status,
    isSample: r.is_sample,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapProperty(r: Row, developmentName = ""): Property {
  return {
    id: r.id,
    developmentId: r.development_id,
    developmentName,
    unitReference: r.unit_reference,
    configuration: r.configuration,
    propertyType: r.property_type,
    bedrooms: num(r.bedrooms),
    bathrooms: num(r.bathrooms),
    area: num(r.area),
    areaUnit: r.area_unit,
    price: num(r.price),
    priceOnRequest: r.price_on_request ?? false,
    currency: r.currency,
    floor: num(r.floor),
    floorPlanPath: r.floor_plan_path,
    imagePaths: r.image_paths ?? [],
    description: r.description,
    features: r.features ?? [],
    availabilityStatus: r.availability_status,
    paymentPlan: r.payment_plan ? plan(r.payment_plan) : null,
    isSample: r.is_sample,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapBrochure(r: Row): Brochure {
  return {
    id: r.id,
    developmentId: r.development_id,
    title: r.title,
    storagePath: r.storage_path,
    fileSizeBytes: Number(r.file_size_bytes),
    allowDownload: r.allow_download,
    isSample: r.is_sample,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
  };
}

export function mapLead(r: Row, names: { development?: string; agent?: string | null } = {}): Lead {
  return {
    id: r.id,
    developmentId: r.development_id,
    developmentName: names.development ?? "",
    buyerName: r.buyer_name,
    phone: r.phone_e164,
    email: r.email,
    configuration: r.configuration,
    budgetMin: num(r.budget_min),
    budgetMax: num(r.budget_max),
    budgetCurrency: r.budget_currency,
    preferredLocation: r.preferred_location,
    bedrooms: num(r.bedrooms),
    preferredFloor: r.preferred_floor,
    propertyType: r.property_type,
    purchaseTimeframe: r.purchase_timeframe,
    assignedAgentId: r.assigned_agent_id,
    assignedAgentName: names.agent ?? null,
    notes: r.notes,
    contactPreference: r.contact_preference,
    status: isLeadStatus(r.status) ? r.status : "new",
    contactedAt: r.contacted_at,
    lastEngagementAt: r.last_engagement_at,
    isSample: r.is_sample,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function micrositeState(r: Row, now = Date.now()): MicrositeState {
  if (r.revoked_at) return "revoked";
  if (r.expires_at && new Date(r.expires_at).getTime() <= now) return "expired";
  return "active";
}

export function mapMicrosite(r: Row): Microsite {
  return {
    id: r.id,
    leadId: r.lead_id,
    state: micrositeState(r),
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    createdAt: r.created_at,
    firstOpenedAt: r.first_opened_at,
    lastActivityAt: r.last_activity_at,
    whatsappInitiatedAt: r.whatsapp_initiated_at,
    messageSentConfirmedAt: r.message_sent_confirmed_at,
    introMessage: r.intro_message,
    showBuyerName: r.show_buyer_name,
  };
}

export const MICROSITE_COLUMNS =
  "id, lead_id, expires_at, revoked_at, created_at, first_opened_at, last_activity_at, whatsapp_initiated_at, message_sent_confirmed_at, intro_message, show_buyer_name";
