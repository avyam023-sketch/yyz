import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, newToken, seedFixture, type Fixture } from "./harness";

let db: PGlite;
let f: Fixture;

beforeEach(async () => {
  db = await createTestDb();
  f = await seedFixture(db);
}, 60_000);

const userA = () => ({ kind: "user" as const, id: f.userA });
const userB = () => ({ kind: "user" as const, id: f.userB });
const anon = { kind: "anon" as const };
const session = "6f1c1f0e-8f1c-4b8e-9a51-0e7c2a0c1a11";

async function createMicrosite(propertyIds: string[], opts: { expiresAt?: string | null } = {}) {
  const { token, hash } = newToken();
  const id = await as(db, userA(), async (tx) => {
    const r = await tx.query<{ id: string }>(
      "select public.create_microsite($1, $2, 'v1.test', $3::uuid[], $4::jsonb, $5) as id",
      [f.leadA, hash, propertyIds, JSON.stringify({ [propertyIds[0]]: "exact" }), opts.expiresAt ?? null],
    );
    return r.rows[0].id;
  });
  return { id, token };
}

async function publicMicrosite(token: string) {
  return as(db, anon, async (tx) => {
    const r = await tx.query<{ data: Record<string, unknown> }>("select public.get_public_microsite($1) as data", [token]);
    return r.rows[0].data;
  });
}

async function track(token: string, type: string, ref: string | null = null, metadata: object = {}) {
  return as(db, anon, async (tx) => {
    const r = await tx.query<{ data: { status: string } }>(
      "select public.record_microsite_event($1, $2, $3, $4, $5::jsonb) as data",
      [token, type, session, ref, JSON.stringify(metadata)],
    );
    return r.rows[0].data;
  });
}

describe("organisation isolation (RLS)", () => {
  it("lets members read only their own organisation's leads", async () => {
    const rows = await as(db, userA(), async (tx) => (await tx.query<{ id: string }>("select id from leads")).rows);
    expect(rows.map((r) => r.id)).toEqual([f.leadA]);

    const other = await as(db, userB(), async (tx) => (await tx.query<{ id: string }>("select id from leads")).rows);
    expect(other.map((r) => r.id)).toEqual([f.leadB]);
  });

  it("blocks inserting a lead into another organisation", async () => {
    await expect(
      as(db, userA(), (tx) =>
        tx.query(
          "insert into leads (organisation_id, development_id, buyer_name, phone_e164, configuration) values ($1, $2, 'X', '+919800000000', '2BHK')",
          [f.orgB, f.devB],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("silently matches zero rows when updating another organisation's lead", async () => {
    const result = await as(db, userA(), (tx) => tx.query("update leads set buyer_name = 'Hacked' where id = $1", [f.leadB]));
    expect(result.affectedRows).toBe(0);
    const name = (await db.query<{ buyer_name: string }>("select buyer_name from leads where id = $1", [f.leadB])).rows[0];
    expect(name.buyer_name).toBe("Other Buyer");
  });

  it("denies anonymous visitors direct table access", async () => {
    await expect(as(db, anon, (tx) => tx.query("select * from leads"))).rejects.toThrow(/permission denied/);
    await expect(as(db, anon, (tx) => tx.query("select * from properties"))).rejects.toThrow(/permission denied/);
  });

  it("prevents a property from referencing another organisation's development", async () => {
    await expect(
      db.query(
        "insert into properties (organisation_id, development_id, unit_reference, configuration) values ($1, $2, 'Z-1', '2BHK')",
        [f.orgA, f.devB],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("does not let users change their own role", async () => {
    await expect(
      as(db, userB(), (tx) => tx.query("update organisation_memberships set role = 'owner' where user_id = $1", [f.userB])),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets users update their own notification preferences", async () => {
    const result = await as(db, userB(), (tx) =>
      tx.query("update organisation_memberships set notify_engagement = true where user_id = $1", [f.userB]),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("does not let agents forge buyer engagement events", async () => {
    await expect(
      as(db, userA(), (tx) =>
        tx.query(
          "insert into engagement_events (organisation_id, lead_id, event_type, actor) values ($1, $2, 'microsite_opened', 'buyer')",
          [f.orgA, f.leadA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("refuses analytics for an organisation the user does not belong to", async () => {
    await expect(
      as(db, userA(), (tx) => tx.query("select public.analytics_summary($1, now() - interval '30 days', now())", [f.orgB])),
    ).rejects.toThrow(/forbidden/);
  });

  it("restricts storage uploads to the organisation's own media folder", async () => {
    const prefixes = await db.query<{ id: string; media_prefix: string }>("select id, media_prefix from organisations");
    const prefixA = prefixes.rows.find((r) => r.id === f.orgA)!.media_prefix;
    const prefixB = prefixes.rows.find((r) => r.id === f.orgB)!.media_prefix;

    await as(db, userA(), (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('property-media', $1)", [`${prefixA}/images/a.jpg`]),
    );
    await expect(
      as(db, userA(), (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('property-media', $1)", [`${prefixB}/images/a.jpg`]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("microsite generation", () => {
  it("creates a microsite, snapshots the selection and advances the lead", async () => {
    const { id } = await createMicrosite([f.propA2bhkInBudget, f.propA2bhkOverBudget]);
    const lead = (await db.query<{ status: string }>("select status from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("microsite_generated");

    const rows = await db.query<{ match_tier: string; snapshot: { unitReference: string; price: number } }>(
      "select match_tier, snapshot from microsite_properties where microsite_id = $1 order by position",
      [id],
    );
    expect(rows.rows.map((r) => r.snapshot.unitReference)).toEqual(["A-1204", "A-1801"]);
    expect(rows.rows[0].match_tier).toBe("exact");
    expect(rows.rows[1].match_tier).toBe("manual");

    const events = await db.query<{ event_type: string }>("select event_type from engagement_events where lead_id = $1 order by occurred_at", [f.leadA]);
    expect(events.rows.map((e) => e.event_type)).toEqual(["lead_created", "microsite_generated"]);
  });

  it("rejects unavailable properties and properties from other organisations", async () => {
    await expect(createMicrosite([f.propASold])).rejects.toThrow(/invalid_property_selection/);
    await expect(createMicrosite([f.propB])).rejects.toThrow(/invalid_property_selection/);
  });

  it("cannot generate a microsite for another organisation's lead", async () => {
    const { hash } = newToken();
    await expect(
      as(db, userB(), (tx) =>
        tx.query("select public.create_microsite($1, $2, 'v1.test', $3::uuid[])", [f.leadA, hash, [f.propA2bhkInBudget]]),
      ),
    ).rejects.toThrow(/lead_not_found/);
  });

  it("revokes the previous link when a new microsite is generated", async () => {
    const first = await createMicrosite([f.propA2bhkInBudget]);
    const second = await createMicrosite([f.propA2bhkOverBudget]);
    expect((await publicMicrosite(first.token)).status).toBe("revoked");
    expect((await publicMicrosite(second.token)).status).toBe("active");
  });

  it("updates the selection while keeping removed rows for history", async () => {
    const { id, token } = await createMicrosite([f.propA2bhkInBudget, f.propA2bhkOverBudget]);
    await as(db, userA(), (tx) =>
      tx.query("select public.update_microsite_selection($1, $2::uuid[])", [id, [f.propA3bhk, f.propA2bhkInBudget]]),
    );
    const site = (await publicMicrosite(token)) as { properties: { unitReference: string }[] };
    expect(site.properties.map((p) => p.unitReference)).toEqual(["B-0902", "A-1204"]);
    const removed = await db.query("select 1 from microsite_properties where microsite_id = $1 and removed_at is not null", [id]);
    expect(removed.rows).toHaveLength(1);
  });
});

describe("public microsite access", () => {
  it("returns presentation data without private fields", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    const site = await publicMicrosite(token);
    expect(site.status).toBe("active");
    expect(site.buyerFirstName).toBe("Ahmed");

    const json = JSON.stringify(site);
    expect(json).not.toContain(f.leadA);
    expect(json).not.toContain(f.propA2bhkInBudget);
    expect(json).not.toContain(f.orgA);
    expect(json).not.toContain("+919812345678");
    expect(json).not.toContain("Private note");
    expect(json).not.toContain("10000000"); // buyer budget
  });

  it("includes the portrait cover used for the personalised welcome", async () => {
    await db.query("update developments set cover_image_path = 'p/images/wide.jpg', cover_image_mobile_path = 'p/images/tall.jpg' where id = $1", [f.devA]);
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    const site = (await publicMicrosite(token)) as { development: { coverImagePath: string; coverImageMobilePath: string } };
    expect(site.development).toMatchObject({ coverImagePath: "p/images/wide.jpg", coverImageMobilePath: "p/images/tall.jpg" });
  });

  it("returns not_found for unknown or malformed tokens", async () => {
    expect((await publicMicrosite(newToken().token)).status).toBe("not_found");
    expect((await publicMicrosite("short")).status).toBe("not_found");
    expect((await publicMicrosite("x' or 1=1 --aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).status).toBe("not_found");
  });

  it("stops exposing content once revoked", async () => {
    const { id, token } = await createMicrosite([f.propA2bhkInBudget]);
    await as(db, userA(), (tx) => tx.query("select public.revoke_microsite($1)", [id]));
    const site = await publicMicrosite(token);
    expect(site).toEqual({ status: "revoked" });
    expect((await track(token, "microsite_opened")).status).toBe("revoked");
  });

  it("stops exposing content once expired", async () => {
    const { id, token } = await createMicrosite([f.propA2bhkInBudget], { expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect((await publicMicrosite(token)).status).toBe("active");
    await db.query("update microsites set expires_at = now() - interval '1 second' where id = $1", [id]);
    expect(await publicMicrosite(token)).toEqual({ status: "expired" });
  });

  it("hides the price of a property that has since been sold", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    await db.query("update properties set availability_status = 'sold' where id = $1", [f.propA2bhkInBudget]);
    const site = (await publicMicrosite(token)) as { properties: { availabilityStatus: string; price: number | null }[] };
    expect(site.properties[0].availabilityStatus).toBe("sold");
    expect(site.properties[0].price).toBeNull();
  });

  it("withholds the price of a home marked price on request", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    await db.query("update properties set price_on_request = true where id = $1", [f.propA2bhkInBudget]);
    const site = (await publicMicrosite(token)) as { properties: { availabilityStatus: string; price: number | null; priceOnRequest: boolean }[] };
    expect(site.properties[0].availabilityStatus).toBe("available");
    expect(site.properties[0].price).toBeNull();
    expect(site.properties[0].priceOnRequest).toBe(true);
  });
});

describe("engagement tracking", () => {
  it("records the first open, notifies the agent and marks the lead engaged", async () => {
    const { token, id } = await createMicrosite([f.propA2bhkInBudget]);
    expect((await track(token, "microsite_opened")).status).toBe("recorded");

    const ms = (await db.query<{ first_opened_at: string | null }>("select first_opened_at from microsites where id = $1", [id])).rows[0];
    expect(ms.first_opened_at).not.toBeNull();
    const lead = (await db.query<{ status: string }>("select status from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("engaged");
    const notes = await db.query<{ type: string; recipient_id: string }>("select type, recipient_id from notifications");
    expect(notes.rows).toEqual([{ type: "microsite_first_open", recipient_id: f.userA }]);
  });

  it("deduplicates refreshes within the same session", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    expect((await track(token, "microsite_opened")).status).toBe("recorded");
    expect((await track(token, "microsite_opened")).status).toBe("deduplicated");
    const count = await db.query("select 1 from engagement_events where event_type = 'microsite_opened'");
    expect(count.rows).toHaveLength(1);
  });

  it("links property events through the public reference only", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    const site = (await publicMicrosite(token)) as { properties: { ref: string }[] };
    expect((await track(token, "floor_plan_opened", site.properties[0].ref)).status).toBe("recorded");
    expect((await track(token, "floor_plan_opened", "notarealref")).status).toBe("invalid_property");
    expect((await track(token, "floor_plan_opened")).status).toBe("invalid_property");

    const ev = await db.query<{ property_id: string }>("select property_id from engagement_events where event_type = 'floor_plan_opened'");
    expect(ev.rows[0].property_id).toBe(f.propA2bhkInBudget);
  });

  it("records brochure pages separately and validates the page number", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    expect((await track(token, "brochure_page_viewed", null, { page: 1 })).status).toBe("recorded");
    expect((await track(token, "brochure_page_viewed", null, { page: 2 })).status).toBe("recorded");
    expect((await track(token, "brochure_page_viewed", null, { page: 2 })).status).toBe("deduplicated");
    expect((await track(token, "brochure_page_viewed", null, { page: -3 })).status).toBe("invalid_metadata");
  });

  it("rejects event types buyers are not allowed to send", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    expect((await track(token, "marked_contacted")).status).toBe("invalid_event");
    expect((await track(token, "viewing_request_submitted")).status).toBe("invalid_event");
  });
});

describe("viewing requests", () => {
  const tomorrow = () => new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  async function submit(token: string, overrides: Partial<{ date: string; range: string; ref: string | null; phone: string }> = {}) {
    return as(db, anon, async (tx) => {
      const r = await tx.query<{ data: { status: string; field?: string } }>(
        "select public.submit_viewing_request($1, $2, 'Ahmed', $3, $4::date, $5, $6, 'Saturday works best') as data",
        [token, session, overrides.phone ?? "+919812345678", overrides.date ?? tomorrow(), overrides.range ?? "morning", overrides.ref ?? null],
      );
      return r.rows[0].data;
    });
  }

  it("stores the request as 'requested', notifies the agent and advances the lead", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    const site = (await publicMicrosite(token)) as { properties: { ref: string }[] };
    expect((await submit(token, { ref: site.properties[0].ref })).status).toBe("submitted");

    const req = (await db.query<{ status: string; property_id: string }>("select status, property_id from viewing_requests")).rows[0];
    expect(req).toEqual({ status: "requested", property_id: f.propA2bhkInBudget });
    const lead = (await db.query<{ status: string }>("select status from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("viewing_requested");
    const notes = await db.query<{ type: string }>("select type from notifications where type = 'viewing_request'");
    expect(notes.rows).toHaveLength(1);
  });

  it("treats an identical resubmission as a duplicate", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    await submit(token);
    expect(await submit(token)).toMatchObject({ status: "submitted", duplicate: true });
    expect((await db.query("select 1 from viewing_requests")).rows).toHaveLength(1);
  });

  it("validates the date, time range and phone", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    expect(await submit(token, { date: "2020-01-01" })).toMatchObject({ status: "invalid", field: "preferredDate" });
    expect(await submit(token, { range: "midnight" })).toMatchObject({ status: "invalid", field: "timeRange" });
    expect(await submit(token, { phone: "12345" })).toMatchObject({ status: "invalid", field: "phone" });
    expect(await submit(token, { ref: "unknownref" })).toMatchObject({ status: "invalid", field: "property" });
  });

  it("requires a time before confirming, then marks the lead viewing_scheduled", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    await submit(token);
    const id = (await db.query<{ id: string }>("select id from viewing_requests")).rows[0].id;

    await expect(
      as(db, userA(), (tx) => tx.query("select public.update_viewing_request($1, 'confirmed')", [id])),
    ).rejects.toThrow(/scheduled_time_required/);

    await as(db, userA(), (tx) =>
      tx.query("select public.update_viewing_request($1, 'confirmed', now() + interval '3 days', 'Meet at sales lounge')", [id]),
    );
    const lead = (await db.query<{ status: string }>("select status from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("viewing_scheduled");
  });

  it("does not let another organisation update the request", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    await submit(token);
    const id = (await db.query<{ id: string }>("select id from viewing_requests")).rows[0].id;
    await expect(
      as(db, userB(), (tx) => tx.query("select public.update_viewing_request($1, 'cancelled')", [id])),
    ).rejects.toThrow(/viewing_request_not_found/);
  });
});

describe("lead status handling", () => {
  it("marks contacted only through the explicit action and records it", async () => {
    await createMicrosite([f.propA2bhkInBudget]);
    const ms = (await db.query<{ id: string }>("select id from microsites")).rows[0];
    await as(db, userA(), (tx) => tx.query("select public.record_whatsapp_initiated($1)", [ms.id]));
    let lead = (await db.query<{ status: string }>("select status from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("microsite_generated");

    await as(db, userA(), (tx) => tx.query("select public.mark_lead_contacted($1)", [f.leadA]));
    lead = (await db.query<{ status: string; contacted_at: string }>("select status, contacted_at from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("contacted");
    const sent = (await db.query<{ message_sent_confirmed_at: string }>("select message_sent_confirmed_at from microsites")).rows[0];
    expect(sent.message_sent_confirmed_at).not.toBeNull();
  });

  it("persists manual status changes with an audit event", async () => {
    await as(db, userA(), (tx) => tx.query("select public.set_lead_status($1, 'lost')", [f.leadA]));
    const lead = (await db.query<{ status: string }>("select status from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("lost");
    const ev = (await db.query<{ metadata: { from: string; to: string } }>("select metadata from engagement_events where event_type = 'lead_status_changed'")).rows[0];
    expect(ev.metadata).toEqual({ from: "new", to: "lost" });
    await expect(as(db, userA(), (tx) => tx.query("select public.set_lead_status($1, 'bogus')", [f.leadA]))).rejects.toThrow(/invalid_status/);
  });

  it("never moves a lost lead forward automatically", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    await as(db, userA(), (tx) => tx.query("select public.set_lead_status($1, 'lost')", [f.leadA]));
    await track(token, "microsite_opened");
    const lead = (await db.query<{ status: string }>("select status from leads where id = $1", [f.leadA])).rows[0];
    expect(lead.status).toBe("lost");
  });
});

describe("analytics", () => {
  it("counts sessions rather than raw refreshes", async () => {
    const { token } = await createMicrosite([f.propA2bhkInBudget]);
    await track(token, "microsite_opened");
    await track(token, "microsite_opened");
    await track(token, "map_opened");
    const summary = await as(db, userA(), async (tx) => {
      const r = await tx.query<{ s: { totals: Record<string, number>; funnel: Record<string, number> } }>(
        "select public.analytics_summary($1, now() - interval '1 day', now() + interval '1 day') as s",
        [f.orgA],
      );
      return r.rows[0].s;
    });
    expect(summary.totals.visits).toBe(1);
    expect(summary.totals.rawEvents).toBe(2);
    expect(summary.funnel.enquiries).toBe(1);
    expect(summary.funnel.opened).toBe(1);
  });
});
