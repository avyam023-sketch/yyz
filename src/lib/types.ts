import type { LeadStatus } from "@/lib/domain/lead-status";

export interface PaymentMilestone {
  label: string;
  value: string;
}

export interface Development {
  id: string;
  name: string;
  developerName: string | null;
  description: string | null;
  location: string | null;
  address: string | null;
  mapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  coverImagePath: string | null;
  coverImageMobilePath: string | null;
  galleryPaths: string[];
  amenities: string[];
  paymentPlan: PaymentMilestone[];
  paymentPlanNotes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  availabilityStatus: string;
  isSample: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  developmentId: string;
  developmentName: string;
  unitReference: string;
  configuration: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  areaUnit: string;
  price: number | null;
  /** Buyers see "Price on request" instead of the price, which stays visible to the team. */
  priceOnRequest: boolean;
  currency: string;
  floor: number | null;
  floorPlanPath: string | null;
  imagePaths: string[];
  description: string | null;
  features: string[];
  availabilityStatus: string;
  paymentPlan: PaymentMilestone[] | null;
  isSample: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Brochure {
  id: string;
  developmentId: string;
  title: string;
  storagePath: string;
  fileSizeBytes: number;
  allowDownload: boolean;
  isSample: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export type MicrositeState = "active" | "revoked" | "expired";

export interface Microsite {
  id: string;
  leadId: string;
  state: MicrositeState;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  firstOpenedAt: string | null;
  lastActivityAt: string | null;
  whatsappInitiatedAt: string | null;
  messageSentConfirmedAt: string | null;
  introMessage: string | null;
  showBuyerName: boolean;
}

export interface Lead {
  id: string;
  developmentId: string;
  developmentName: string;
  buyerName: string;
  phone: string;
  email: string | null;
  configuration: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string;
  preferredLocation: string | null;
  bedrooms: number | null;
  preferredFloor: string | null;
  propertyType: string | null;
  purchaseTimeframe: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  notes: string | null;
  contactPreference: string;
  status: LeadStatus;
  contactedAt: string | null;
  lastEngagementAt: string | null;
  isSample: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListItem extends Lead {
  microsite: Pick<Microsite, "id" | "state" | "firstOpenedAt"> | null;
}

export interface ViewingRequest {
  id: string;
  leadId: string;
  micrositeId: string;
  buyerName: string;
  name: string;
  phone: string;
  propertyLabel: string | null;
  developmentName: string | null;
  preferredDate: string;
  preferredTimeRange: string;
  message: string | null;
  status: string;
  scheduledFor: string | null;
  agentNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  leadId: string | null;
  readAt: string | null;
  createdAt: string;
  emailStatus: "not_sent" | "sending" | "accepted" | "failed" | "skipped";
}

/** Shape returned by public.get_public_microsite for an active link. */
export interface PublicMicrosite {
  status: "active";
  organisationName: string;
  buyerFirstName: string | null;
  configuration: string;
  introMessage: string | null;
  expiresAt: string | null;
  agent: { name: string | null; phone: string | null };
  development: {
    name: string;
    developerName: string | null;
    description: string | null;
    location: string | null;
    address: string | null;
    mapUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    coverImagePath: string | null;
    coverImageMobilePath: string | null;
    galleryPaths: string[];
    amenities: string[];
    paymentPlan: PaymentMilestone[];
    paymentPlanNotes: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  };
  brochure: { title: string; path: string; allowDownload: boolean } | null;
  properties: PublicProperty[];
}

export interface PublicProperty {
  ref: string;
  developmentName: string;
  unitReference: string;
  configuration: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  areaUnit: string;
  availabilityStatus: string;
  price: number | null;
  priceOnRequest: boolean;
  currency: string;
  floor: number | null;
  floorPlanPath: string | null;
  imagePaths: string[];
  description: string | null;
  features: string[];
  paymentPlan: PaymentMilestone[] | null;
}

export type PublicMicrositeResult = PublicMicrosite | { status: "not_found" | "revoked" | "expired" };
