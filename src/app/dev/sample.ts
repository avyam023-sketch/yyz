import { notFound } from "next/navigation";
import { SAMPLE_DEVELOPMENTS } from "@/lib/sample/catalogue";
import type { PublicMicrosite } from "@/lib/types";

/**
 * Development-only design QA. These routes render the buyer experience with
 * FICTIONAL sample data so layout can be checked without a database. They
 * return 404 in production builds.
 */
export function assertDevOnly() {
  if (process.env.NODE_ENV === "production") notFound();
}

export function sampleMicrosite(): PublicMicrosite {
  const d = SAMPLE_DEVELOPMENTS[0];
  const picks = d.properties.filter((p) => p.configuration === "2BHK").slice(0, 4);
  return {
    status: "active",
    organisationName: "Clannco Demo Agency (Sample)",
    buyerFirstName: "Ahmed",
    configuration: "2BHK",
    introMessage: null,
    expiresAt: null,
    agent: { name: "Priya Sharma", phone: "+919800000001" },
    development: {
      name: d.name,
      developerName: d.developerName,
      description: d.description,
      location: d.location,
      address: d.address,
      mapUrl: null,
      latitude: d.latitude,
      longitude: d.longitude,
      coverImagePath: null,
      coverImageMobilePath: null,
      galleryPaths: [],
      amenities: d.amenities,
      paymentPlan: d.paymentPlan,
      paymentPlanNotes: d.paymentPlanNotes,
      contactName: d.contactName,
      contactPhone: null,
      contactEmail: d.contactEmail,
    },
    brochure: { title: `${d.name} brochure (sample)`, path: "sample/brochure.pdf", allowDownload: true },
    properties: picks.map((p, i) => ({
      ref: `00000000${String(i).padStart(2, "0")}`,
      developmentName: d.name,
      unitReference: p.unitReference,
      configuration: p.configuration,
      propertyType: p.propertyType,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      area: p.area,
      areaUnit: "sqft",
      availabilityStatus: i === 3 ? "reserved" : "available",
      price: i === 3 || p.priceOnRequest ? null : p.price,
      priceOnRequest: p.priceOnRequest ?? false,
      currency: "INR",
      floor: p.floor,
      floorPlanPath: null,
      imagePaths: [],
      description: p.description,
      features: p.features,
      paymentPlan: d.paymentPlan,
    })),
  };
}
