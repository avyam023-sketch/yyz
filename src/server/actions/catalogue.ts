"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionAuth, type AuthContext } from "@/server/auth";
import { check, fail, ok, required, toActionError, type ActionResult } from "@/server/action-result";
import {
  brochureSchema,
  developmentSchema,
  propertySchema,
  type DevelopmentInput,
  type DevelopmentValues,
  type PropertyInput,
  type PropertyValues,
} from "@/lib/validation/schemas";

/** Uploaded media must live in the acting organisation's own folder. */
function assertOwnMedia(ctx: AuthContext, paths: (string | null)[]) {
  const prefix = `${ctx.organisation.mediaPrefix}/`;
  if (paths.some((p) => p !== null && !p.startsWith(prefix))) {
    throw new z.ZodError([{ code: "custom", path: ["media"], message: "A file does not belong to this organisation", input: null }]);
  }
}

function developmentRow(v: DevelopmentValues) {
  return {
    name: v.name,
    developer_name: v.developerName,
    description: v.description,
    location: v.location,
    address: v.address,
    map_url: v.mapUrl,
    latitude: v.latitude,
    longitude: v.longitude,
    amenities: v.amenities,
    payment_plan: v.paymentPlan,
    payment_plan_notes: v.paymentPlanNotes,
    contact_name: v.contactName,
    contact_phone_e164: v.contactPhone,
    contact_email: v.contactEmail,
    availability_status: v.availabilityStatus,
    cover_image_path: v.coverImagePath,
    cover_image_mobile_path: v.coverImageMobilePath,
    gallery_paths: v.galleryPaths,
  };
}

function propertyRow(v: PropertyValues) {
  return {
    development_id: v.developmentId,
    unit_reference: v.unitReference,
    configuration: v.configuration,
    property_type: v.propertyType,
    bedrooms: v.bedrooms,
    bathrooms: v.bathrooms,
    area: v.area,
    area_unit: v.areaUnit,
    price: v.price,
    price_on_request: v.priceOnRequest,
    currency: v.currency,
    floor: v.floor,
    description: v.description,
    features: v.features,
    availability_status: v.availabilityStatus,
    payment_plan: v.usesDevelopmentPaymentPlan || v.paymentPlan.length === 0 ? null : v.paymentPlan,
    floor_plan_path: v.floorPlanPath,
    image_paths: v.imagePaths,
  };
}

export async function saveDevelopment(id: string | null, input: DevelopmentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireActionAuth();
    const parsed = developmentSchema.safeParse(input);
    if (!parsed.success) throw parsed.error;
    const v = parsed.data;
    assertOwnMedia(ctx, [v.coverImagePath, v.coverImageMobilePath, ...v.galleryPaths]);

    let savedId: string;
    if (id) {
      const row = check(
        await ctx.supabase
          .from("developments")
          .update(developmentRow(v))
          .eq("organisation_id", ctx.organisation.id)
          .eq("id", z.uuid().parse(id))
          .select("id")
          .maybeSingle(),
      );
      if (!row) return fail("That development could not be found.");
      savedId = row.id as string;
    } else {
      const row = required(
        await ctx.supabase
          .from("developments")
          .insert({ ...developmentRow(v), organisation_id: ctx.organisation.id })
          .select("id")
          .single(),
      );
      savedId = row.id as string;
    }
    revalidatePath("/dashboard", "layout");
    return ok({ id: savedId }, id ? "Development updated" : "Development created");
  } catch (error) {
    return toActionError(error, "saveDevelopment");
  }
}

export async function setDevelopmentArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const updated = check(
      await ctx.supabase
        .from("developments")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("organisation_id", ctx.organisation.id)
        .eq("id", z.uuid().parse(id))
        .select("id")
        .maybeSingle(),
    );
    if (!updated) return fail("That development could not be found.");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, archived ? "Development archived" : "Development restored");
  } catch (error) {
    return toActionError(error, "setDevelopmentArchived");
  }
}

export async function saveProperty(id: string | null, input: PropertyInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireActionAuth();
    const parsed = propertySchema.safeParse(input);
    if (!parsed.success) throw parsed.error;
    const v = parsed.data;
    assertOwnMedia(ctx, [v.floorPlanPath, ...v.imagePaths]);

    const development = check(
      await ctx.supabase.from("developments").select("id").eq("organisation_id", ctx.organisation.id).eq("id", v.developmentId).maybeSingle(),
    );
    if (!development) return fail("Please correct the highlighted fields.", { developmentId: "Choose a development" });

    let savedId: string;
    if (id) {
      const row = check(
        await ctx.supabase
          .from("properties")
          .update(propertyRow(v))
          .eq("organisation_id", ctx.organisation.id)
          .eq("id", z.uuid().parse(id))
          .select("id")
          .maybeSingle(),
      );
      if (!row) return fail("That property could not be found.");
      savedId = row.id as string;
    } else {
      const row = required(
        await ctx.supabase
          .from("properties")
          .insert({ ...propertyRow(v), organisation_id: ctx.organisation.id })
          .select("id")
          .single(),
      );
      savedId = row.id as string;
    }
    revalidatePath("/dashboard", "layout");
    return ok({ id: savedId }, id ? "Property updated" : "Property created");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "23505") {
      return fail("Please correct the highlighted fields.", { unitReference: "This unit reference already exists in the development" });
    }
    return toActionError(error, "saveProperty");
  }
}

export async function setPropertyArchived(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const updated = check(
      await ctx.supabase
        .from("properties")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("organisation_id", ctx.organisation.id)
        .eq("id", z.uuid().parse(id))
        .select("id")
        .maybeSingle(),
    );
    if (!updated) return fail("That property could not be found.");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, archived ? "Property archived. It will show as unavailable on existing microsites." : "Property restored");
  } catch (error) {
    return toActionError(error, "setPropertyArchived");
  }
}

export async function setPropertyAvailability(id: string, status: string): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const v = z.object({ id: z.uuid(), status: propertySchema.shape.availabilityStatus.unwrap() }).parse({ id, status });
    const updated = check(
      await ctx.supabase
        .from("properties")
        .update({ availability_status: v.status })
        .eq("organisation_id", ctx.organisation.id)
        .eq("id", v.id)
        .select("id")
        .maybeSingle(),
    );
    if (!updated) return fail("That property could not be found.");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Availability updated");
  } catch (error) {
    return toActionError(error, "setPropertyAvailability");
  }
}

export async function addBrochure(input: z.input<typeof brochureSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireActionAuth();
    const v = brochureSchema.parse(input);
    assertOwnMedia(ctx, [v.storagePath]);
    const row = required(
      await ctx.supabase
        .from("brochure_assets")
        .insert({
          organisation_id: ctx.organisation.id,
          development_id: v.developmentId,
          title: v.title,
          storage_path: v.storagePath,
          file_size_bytes: v.fileSizeBytes,
          mime_type: "application/pdf",
          allow_download: v.allowDownload,
        })
        .select("id")
        .single(),
    );
    revalidatePath("/dashboard", "layout");
    return ok({ id: row.id as string }, "Brochure added. Microsites for this development now show it.");
  } catch (error) {
    return toActionError(error, "addBrochure");
  }
}

export async function updateBrochure(id: string, changes: { allowDownload?: boolean; archived?: boolean }): Promise<ActionResult> {
  try {
    const ctx = await requireActionAuth();
    const patch: Record<string, unknown> = {};
    if (changes.allowDownload !== undefined) patch.allow_download = changes.allowDownload;
    if (changes.archived !== undefined) patch.archived_at = changes.archived ? new Date().toISOString() : null;
    const updated = check(
      await ctx.supabase
        .from("brochure_assets")
        .update(patch)
        .eq("organisation_id", ctx.organisation.id)
        .eq("id", z.uuid().parse(id))
        .select("id")
        .maybeSingle(),
    );
    if (!updated) return fail("That brochure could not be found.");
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "Brochure updated");
  } catch (error) {
    return toActionError(error, "updateBrochure");
  }
}
