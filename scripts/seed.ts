/**
 * Seeds a Supabase project with a SAMPLE organisation, an admin account and a
 * fictional property catalogue for development and demos.
 *
 *   SEED_ADMIN_EMAIL=you@agency.com SEED_ADMIN_PASSWORD='a long password' npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy
 * SUPABASE_SERVICE_ROLE_KEY) in .env.local. The secret key is used only by this
 * script, never by the web application.
 *
 * No enquiries, microsites or engagement are created: those come from using
 * the product, so analytics never show invented activity.
 */
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SAMPLE_DEVELOPMENTS, SAMPLE_ORGANISATION, buildSampleBrochurePdf } from "../src/lib/sample/catalogue";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

function required(name: string, alt?: string): string {
  const value = process.env[name] ?? (alt ? process.env[alt] : undefined);
  if (!value) {
    console.error(`Missing ${name}${alt ? ` (or ${alt})` : ""}. See README → "Seed sample data".`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const secret = required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const email = required("SEED_ADMIN_EMAIL").toLowerCase();
  const password = required("SEED_ADMIN_PASSWORD");
  if (password.length < 12) {
    console.error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
  const fullName = process.env.SEED_ADMIN_NAME?.trim() || "Demo Agent";
  // Empty values in .env files arrive as "", which means "not set".
  const phone = process.env.SEED_ADMIN_PHONE?.trim() || null;

  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const fail = (step: string, error: { message: string } | null) => {
    if (error) {
      console.error(`✗ ${step}: ${error.message}`);
      process.exit(1);
    }
  };

  // 1. Admin user (created confirmed, so no email round-trip is needed locally).
  let userId: string | undefined;
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (created.data.user) {
    userId = created.data.user.id;
    console.log(`✓ Created user ${email}`);
  } else {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      fail("list users", error);
      userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (data.users.length < 200) break;
    }
    if (!userId) fail("create user", created.error ?? { message: "unknown error" });
    console.log(`• User ${email} already exists; password left unchanged`);
  }

  const profile = await db.from("profiles").upsert({ id: userId, email, full_name: fullName, phone_e164: phone }, { onConflict: "id" });
  fail("profile", profile.error);

  // 2. Sample organisation and membership.
  let { data: org } = await db.from("organisations").select("id, media_prefix").eq("slug", SAMPLE_ORGANISATION.slug).maybeSingle();
  const isNewOrg = !org;
  if (!org) {
    const inserted = await db
      .from("organisations")
      .insert({ name: SAMPLE_ORGANISATION.name, slug: SAMPLE_ORGANISATION.slug, is_sample: true, timezone: "Asia/Kolkata", default_currency: "INR" })
      .select("id, media_prefix")
      .single();
    fail("organisation", inserted.error);
    org = inserted.data;
    console.log(`✓ Created organisation "${SAMPLE_ORGANISATION.name}"`);
  }
  const membership = await db
    .from("organisation_memberships")
    .upsert({ organisation_id: org!.id, user_id: userId, role: "owner" }, { onConflict: "organisation_id,user_id" });
  fail("membership", membership.error);
  console.log(`✓ ${email} is an owner of the sample organisation`);

  if (!isNewOrg) {
    console.log("• Sample catalogue already exists; nothing else to do.");
    return;
  }

  // 3. Fictional catalogue.
  for (const dev of SAMPLE_DEVELOPMENTS) {
    const { properties, ...d } = dev;
    const inserted = await db
      .from("developments")
      .insert({
        organisation_id: org!.id,
        name: d.name,
        developer_name: d.developerName,
        description: d.description,
        location: d.location,
        address: d.address,
        latitude: d.latitude,
        longitude: d.longitude,
        amenities: d.amenities,
        payment_plan: d.paymentPlan,
        payment_plan_notes: d.paymentPlanNotes,
        contact_name: d.contactName,
        contact_phone_e164: phone,
        contact_email: d.contactEmail,
        availability_status: d.availabilityStatus,
        is_sample: true,
      })
      .select("id")
      .single();
    fail(`development ${d.name}`, inserted.error);
    const developmentId = inserted.data!.id;

    const props = await db.from("properties").insert(
      properties.map((p) => ({
        organisation_id: org!.id,
        development_id: developmentId,
        unit_reference: p.unitReference,
        configuration: p.configuration,
        property_type: p.propertyType,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        area_unit: "sqft",
        price: p.price,
        price_on_request: p.priceOnRequest ?? false,
        currency: "INR",
        floor: p.floor,
        description: p.description,
        features: p.features,
        availability_status: p.availabilityStatus,
        is_sample: true,
      })),
    );
    fail(`properties for ${d.name}`, props.error);

    const pdf = buildSampleBrochurePdf(d.name);
    const path = `${org!.media_prefix}/brochures/${randomUUID()}.pdf`;
    const upload = await db.storage.from("property-media").upload(path, pdf, { contentType: "application/pdf" });
    if (upload.error) {
      console.warn(`! Brochure upload skipped for ${d.name}: ${upload.error.message}`);
    } else {
      const brochure = await db.from("brochure_assets").insert({
        organisation_id: org!.id,
        development_id: developmentId,
        title: `${d.name} brochure (sample)`,
        storage_path: path,
        file_size_bytes: pdf.byteLength,
        mime_type: "application/pdf",
        allow_download: true,
        is_sample: true,
      });
      fail(`brochure for ${d.name}`, brochure.error);
    }
    console.log(`✓ ${d.name}: ${properties.length} sample units`);
  }

  console.log("\nDone. Sign in at /login and create an enquiry (e.g. a 2BHK in Example Residences, budget 80L–1Cr).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
