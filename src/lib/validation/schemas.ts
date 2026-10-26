import { z } from "zod";
import {
  AREA_UNITS,
  CONFIGURATIONS,
  CONTACT_PREFERENCES,
  DEVELOPMENT_AVAILABILITY,
  MAX_MICROSITE_PROPERTIES,
  PROPERTY_AVAILABILITY,
  PROPERTY_TYPES,
  PURCHASE_TIMEFRAMES,
  TIME_RANGES,
  VIEWING_STATUSES,
} from "@/lib/domain/constants";
import { BUYER_EVENT_TYPES } from "@/lib/domain/events";
import { LEAD_STATUSES } from "@/lib/domain/lead-status";
import { parseIndianAmount } from "@/lib/domain/money";
import { normalisePhone } from "@/lib/domain/phone";

// ---------------------------------------------------------------------------
// Field helpers. Forms submit strings; these turn them into typed values.
// ---------------------------------------------------------------------------

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : null));

const requiredText = (label: string, max: number) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `Must be ${max} characters or fewer`);

export const phoneField = z
  .string({ error: "Enter a mobile number" })
  .trim()
  .min(1, "Enter a mobile number")
  .transform((value, ctx) => {
    const result = normalisePhone(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.e164;
  });

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const result = normalisePhone(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.e164;
  });

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    if (!z.email().safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email address" });
      return z.NEVER;
    }
    return value.toLowerCase();
  });

const amount = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    const parsed = parseIndianAmount(value ?? null);
    if (parsed === null) return null;
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1e13) {
      ctx.addIssue({ code: "custom", message: "Enter an amount such as 80L, 1.2Cr or 8500000" });
      return z.NEVER;
    }
    return parsed;
  });

const optionalInt = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "") return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });

const optionalDecimal = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "") return null;
      const n = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });

/** Optional select: "" and "none" both mean "not set". */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(""), z.literal("none")])
    .optional()
    .transform((v) => (v && v !== "none" ? (v as T[number]) : null));

const optionalUuid = z
  .union([z.uuid(), z.literal(""), z.literal("none")])
  .optional()
  .transform((v) => (v && v !== "none" ? v : null));

/** Comma- or newline-separated list → trimmed, de-duplicated array. */
const stringList = (maxItems: number, maxLength: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value, ctx) => {
      const items = (Array.isArray(value) ? value : (value ?? "").split(/[\n,]/))
        .map((s) => s.trim())
        .filter(Boolean);
      const unique = Array.from(new Set(items));
      if (unique.length > maxItems) {
        ctx.addIssue({ code: "custom", message: `Up to ${maxItems} items` });
        return z.NEVER;
      }
      if (unique.some((s) => s.length > maxLength)) {
        ctx.addIssue({ code: "custom", message: `Each item must be ${maxLength} characters or fewer` });
        return z.NEVER;
      }
      return unique;
    });

export const paymentPlanSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1, "Add a milestone").max(80),
      value: z.string().trim().min(1, "Add an amount or percentage").max(80),
    }),
  )
  .max(20, "Up to 20 milestones");

// Media paths are "<org media prefix>/<folder>/<random>.<ext>". The server
// additionally checks that the prefix belongs to the user's organisation.
export const MEDIA_PATH_PATTERN = /^[a-f0-9]{24}\/(images|floor-plans|brochures)\/[a-z0-9-]{8,80}\.(jpg|jpeg|png|webp|avif|pdf)$/;
const mediaPath = z.string().regex(MEDIA_PATH_PATTERN, "Invalid file reference");
const optionalMediaPath = z
  .union([mediaPath, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

export const leadSchema = z
  .object({
    buyerName: requiredText("Buyer name", 120),
    phone: phoneField,
    developmentId: z.uuid({ error: "Choose a development" }),
    configuration: z.enum(CONFIGURATIONS, { error: "Choose a configuration" }),
    email: optionalEmail,
    budgetMin: amount,
    budgetMax: amount,
    preferredLocation: text(160),
    bedrooms: optionalInt(0, 20, "Bedrooms"),
    preferredFloor: text(60),
    propertyType: optionalEnum(PROPERTY_TYPES),
    purchaseTimeframe: optionalEnum(PURCHASE_TIMEFRAMES),
    assignedAgentId: optionalUuid,
    notes: text(4000),
    contactPreference: z.enum(CONTACT_PREFERENCES).default("whatsapp"),
  })
  .superRefine((d, ctx) => {
    if (d.budgetMin !== null && d.budgetMax !== null && d.budgetMin > d.budgetMax) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Maximum budget must be at least the minimum" });
    }
    if (d.contactPreference === "email" && !d.email) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Add an email address or choose another contact preference" });
    }
  });
export type LeadInput = z.input<typeof leadSchema>;
export type LeadValues = z.output<typeof leadSchema>;

export const leadStatusSchema = z.object({
  leadId: z.uuid(),
  status: z.enum(LEAD_STATUSES),
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const developmentSchema = z.object({
  name: requiredText("Development name", 120).refine((v) => v.length >= 2, "Development name is too short"),
  developerName: text(120),
  description: text(4000),
  location: text(160),
  address: text(400),
  mapUrl: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!/^https:\/\/[^\s]+$/i.test(value)) {
        ctx.addIssue({ code: "custom", message: "Use a full https:// link, e.g. a Google Maps share link" });
        return z.NEVER;
      }
      return value;
    }),
  latitude: optionalDecimal(-90, 90, "Latitude"),
  longitude: optionalDecimal(-180, 180, "Longitude"),
  amenities: stringList(40, 80),
  paymentPlan: paymentPlanSchema.default([]),
  paymentPlanNotes: text(1000),
  contactName: text(120),
  contactPhone: optionalPhone,
  contactEmail: optionalEmail,
  availabilityStatus: z.enum(DEVELOPMENT_AVAILABILITY).default("available"),
  coverImagePath: optionalMediaPath,
  coverImageMobilePath: optionalMediaPath,
  galleryPaths: z.array(mediaPath).max(24, "Up to 24 gallery images").default([]),
});
export type DevelopmentInput = z.input<typeof developmentSchema>;
export type DevelopmentValues = z.output<typeof developmentSchema>;

export const propertySchema = z.object({
  developmentId: z.uuid({ error: "Choose a development" }),
  unitReference: requiredText("Unit reference", 40),
  configuration: z.enum(CONFIGURATIONS, { error: "Choose a configuration" }),
  propertyType: z.enum(PROPERTY_TYPES).default("apartment"),
  bedrooms: optionalInt(0, 20, "Bedrooms"),
  bathrooms: optionalInt(0, 20, "Bathrooms"),
  area: optionalDecimal(1, 1_000_000, "Area"),
  areaUnit: z.enum(AREA_UNITS).default("sqft"),
  price: amount,
  priceOnRequest: z.boolean().default(false),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as INR")
    .default("INR"),
  floor: optionalInt(-5, 250, "Floor"),
  description: text(4000),
  features: stringList(40, 80),
  availabilityStatus: z.enum(PROPERTY_AVAILABILITY).default("available"),
  usesDevelopmentPaymentPlan: z.boolean().default(true),
  paymentPlan: paymentPlanSchema.default([]),
  floorPlanPath: optionalMediaPath,
  imagePaths: z.array(mediaPath).max(24, "Up to 24 images").default([]),
});
export type PropertyInput = z.input<typeof propertySchema>;
export type PropertyValues = z.output<typeof propertySchema>;

export const brochureSchema = z.object({
  developmentId: z.uuid(),
  title: requiredText("Title", 160),
  storagePath: mediaPath.refine((p) => p.endsWith(".pdf"), "Brochures must be PDF files"),
  fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024, "Brochures must be 25 MB or smaller"),
  allowDownload: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Microsites
// ---------------------------------------------------------------------------

export const micrositeSelectionSchema = z.object({
  leadId: z.uuid(),
  propertyIds: z
    .array(z.uuid())
    .min(1, "Select at least one property")
    .max(MAX_MICROSITE_PROPERTIES, `Select up to ${MAX_MICROSITE_PROPERTIES} properties`)
    .refine((ids) => new Set(ids).size === ids.length, "Each property can only be selected once"),
  matchTiers: z.record(z.string(), z.enum(["exact", "close", "other", "manual"])).default({}),
  expiry: z.enum(["30", "60", "90", "never"]).default("60"),
  introMessage: text(600),
  showBuyerName: z.boolean().default(true),
});
export type MicrositeSelectionInput = z.input<typeof micrositeSelectionSchema>;

// ---------------------------------------------------------------------------
// Public (buyer) input
// ---------------------------------------------------------------------------

export const PUBLIC_REF_PATTERN = /^[0-9a-f]{10}$/;

export const trackEventSchema = z.object({
  eventType: z.enum(BUYER_EVENT_TYPES),
  sessionId: z.uuid(),
  propertyRef: z.string().regex(PUBLIC_REF_PATTERN).nullish(),
  metadata: z
    .object({ page: z.number().int().min(1).max(2000).optional() })
    .strict()
    .default({}),
});
export type TrackEventInput = z.input<typeof trackEventSchema>;

export const viewingRequestSchema = z.object({
  name: requiredText("Name", 120),
  phone: phoneField,
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  timeRange: z.enum(TIME_RANGES, { error: "Choose a time of day" }),
  propertyRef: z
    .union([z.string().regex(PUBLIC_REF_PATTERN), z.literal(""), z.literal("any")])
    .optional()
    .transform((v) => (v && v !== "any" ? v : null)),
  message: text(1000),
  sessionId: z.uuid(),
});
export type ViewingRequestInput = z.input<typeof viewingRequestSchema>;

export const viewingUpdateSchema = z
  .object({
    requestId: z.uuid(),
    status: z.enum(VIEWING_STATUSES),
    scheduledFor: z.string().optional(),
    agentNotes: text(2000),
  })
  .superRefine((d, ctx) => {
    if ((d.status === "confirmed" || d.status === "rescheduled") && !d.scheduledFor) {
      ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Choose the confirmed date and time" });
    }
  });

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  fullName: requiredText("Name", 120),
  phone: optionalPhone,
});

export const notificationPreferencesSchema = z.object({
  notifyFirstOpen: z.boolean(),
  notifyViewingRequest: z.boolean(),
  notifyContactRequest: z.boolean(),
  notifyEngagement: z.boolean(),
  notifyEmail: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.email("Enter your work email"),
  password: z.string().min(1, "Enter your password"),
});

/** Flattens Zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
