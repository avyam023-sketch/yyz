-- Price on request: the agent keeps the real price for matching and their own
-- view, but buyers see "Price on request" instead of a figure. Re-creates
-- get_public_microsite to withhold it (privileges are kept by CREATE OR REPLACE).

alter table public.properties add column if not exists price_on_request boolean not null default false;

create or replace function public.get_public_microsite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
  v_result jsonb;
begin
  select * into v from public.microsite_by_token(p_token);
  if v.state <> 'active' then
    return jsonb_build_object('status', v.state);
  end if;

  select jsonb_build_object(
    'status', 'active',
    'organisationName', o.name,
    'buyerFirstName', case when m.show_buyer_name then nullif(split_part(btrim(l.buyer_name), ' ', 1), '') end,
    'configuration', l.configuration,
    'introMessage', m.intro_message,
    'expiresAt', m.expires_at,
    'agent', jsonb_build_object(
      'name', coalesce(p.full_name, d.contact_name),
      'phone', coalesce(p.phone_e164, d.contact_phone_e164)
    ),
    'development', jsonb_build_object(
      'name', d.name,
      'developerName', d.developer_name,
      'description', d.description,
      'location', d.location,
      'address', d.address,
      'mapUrl', d.map_url,
      'latitude', d.latitude,
      'longitude', d.longitude,
      'coverImagePath', d.cover_image_path,
      'coverImageMobilePath', d.cover_image_mobile_path,
      'galleryPaths', to_jsonb(d.gallery_paths),
      'amenities', to_jsonb(d.amenities),
      'paymentPlan', d.payment_plan,
      'paymentPlanNotes', d.payment_plan_notes,
      'contactName', d.contact_name,
      'contactPhone', d.contact_phone_e164,
      'contactEmail', d.contact_email
    ),
    'brochure', (
      select jsonb_build_object('title', b.title, 'path', b.storage_path, 'allowDownload', b.allow_download)
      from public.brochure_assets b
      where b.development_id = d.id and b.archived_at is null
      order by b.created_at desc
      limit 1
    ),
    'properties', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ref', mp.public_ref,
          'developmentName', pd.name,
          'unitReference', pr.unit_reference,
          'configuration', pr.configuration,
          'propertyType', pr.property_type,
          'bedrooms', pr.bedrooms,
          'bathrooms', pr.bathrooms,
          'area', pr.area,
          'areaUnit', pr.area_unit,
          'availabilityStatus', case when pr.archived_at is not null then 'unavailable' else pr.availability_status end,
          -- Prices are only shown for homes that are still available and not marked "price on request".
          'price', case when pr.archived_at is null and pr.availability_status = 'available' and not pr.price_on_request then pr.price end,
          'priceOnRequest', pr.price_on_request,
          'currency', pr.currency,
          'floor', pr.floor,
          'floorPlanPath', pr.floor_plan_path,
          'imagePaths', to_jsonb(pr.image_paths),
          'description', pr.description,
          'features', to_jsonb(pr.features),
          'paymentPlan', coalesce(pr.payment_plan, pd.payment_plan)
        )
        order by mp.position
      )
      from public.microsite_properties mp
      join public.properties pr on pr.id = mp.property_id
      join public.developments pd on pd.id = pr.development_id
      where mp.microsite_id = m.id and mp.removed_at is null
    ), '[]'::jsonb)
  )
  into v_result
  from public.microsites m
  join public.leads l on l.id = m.lead_id
  join public.developments d on d.id = l.development_id
  join public.organisations o on o.id = m.organisation_id
  left join public.profiles p on p.id = coalesce(l.assigned_agent_id, l.created_by)
  where m.id = v.microsite_id;

  return v_result;
end;
$$;
