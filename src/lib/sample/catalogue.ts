/**
 * FICTIONAL SAMPLE DATA for local development and demonstrations only.
 * None of these developments, units, prices or people exist. Records created
 * from this file are stored with is_sample = true and badged "Sample" in the UI.
 */

export interface SampleProperty {
  unitReference: string;
  configuration: string;
  propertyType: "apartment" | "villa" | "penthouse";
  bedrooms: number;
  bathrooms: number;
  area: number;
  price: number;
  priceOnRequest?: boolean;
  floor: number;
  availabilityStatus: "available" | "reserved" | "sold";
  description: string;
  features: string[];
}

export interface SampleDevelopment {
  name: string;
  developerName: string;
  description: string;
  location: string;
  address: string;
  latitude: number;
  longitude: number;
  amenities: string[];
  paymentPlan: { label: string; value: string }[];
  paymentPlanNotes: string;
  contactName: string;
  contactEmail: string;
  availabilityStatus: "upcoming" | "available" | "limited" | "sold_out";
  properties: SampleProperty[];
}

const apt = (
  unitReference: string,
  configuration: string,
  bedrooms: number,
  area: number,
  price: number,
  floor: number,
  availabilityStatus: SampleProperty["availabilityStatus"] = "available",
  features: string[] = [],
): SampleProperty => ({
  unitReference,
  configuration,
  propertyType: "apartment",
  bedrooms,
  bathrooms: Math.max(1, bedrooms),
  area,
  price,
  floor,
  availabilityStatus,
  description: `A ${configuration} residence on the ${floor}${floor === 1 ? "st" : floor === 2 ? "nd" : floor === 3 ? "rd" : "th"} floor with a private balcony and cross-ventilated living spaces.`,
  features,
});

export const SAMPLE_ORGANISATION = { name: "Clannco Demo Agency (Sample)", slug: "clannco-demo" };

export const SAMPLE_DEVELOPMENTS: SampleDevelopment[] = [
  {
    name: "Example Residences",
    developerName: "Sample Developers Pvt Ltd",
    description:
      "Example Residences is a fictional development of two towers set around a landscaped central garden. Homes are planned for natural light, with deep balconies and efficient layouts.",
    location: "Baner, Pune",
    address: "Sample Road, Baner, Pune 411045 (fictional)",
    latitude: 18.559,
    longitude: 73.7868,
    amenities: ["Clubhouse", "Swimming pool", "Landscaped central garden", "Children's play area", "Gymnasium", "Co-working lounge", "EV charging", "24×7 security"],
    paymentPlan: [
      { label: "On booking", value: "10%" },
      { label: "Within 30 days of agreement", value: "15%" },
      { label: "On completion of plinth", value: "15%" },
      { label: "Slab-linked instalments", value: "50%" },
      { label: "On possession", value: "10%" },
    ],
    paymentPlanNotes: "Construction-linked plan. Stamp duty, registration and GST are payable in addition. Sample terms for demonstration.",
    contactName: "Sales Lounge (Sample)",
    contactEmail: "sales@example.com",
    availabilityStatus: "available",
    properties: [
      apt("A-0802", "2BHK", 2, 1040, 8_400_000, 8, "available", ["East facing", "Garden view"]),
      apt("A-1204", "2BHK", 2, 1085, 9_200_000, 12, "available", ["Park view", "Corner unit"]),
      { ...apt("B-1503", "2BHK", 2, 1110, 9_850_000, 15, "available", ["City view", "Two balconies"]), priceOnRequest: true },
      apt("A-1801", "2BHK", 2, 1150, 11_200_000, 18, "available", ["High floor", "Panoramic view"]),
      apt("A-0603", "2BHK", 2, 1040, 8_800_000, 6, "reserved"),
      apt("A-0302", "2BHK", 2, 1020, 7_900_000, 3, "sold"),
      apt("A-0501", "1BHK", 1, 640, 5_800_000, 5, "available", ["Ideal starter home"]),
      apt("B-0902", "3BHK", 3, 1480, 13_500_000, 9, "available", ["Three balconies", "Study nook"]),
      apt("B-1402", "3BHK", 3, 1520, 14_800_000, 14, "available", ["Garden view"]),
      { ...apt("B-2101", "4BHK", 4, 2150, 21_000_000, 21, "available", ["Private deck", "Servant room"]), priceOnRequest: true },
    ],
  },
  {
    name: "Aurelia Heights",
    developerName: "Sample Developers Pvt Ltd",
    description: "A fictional tower of compact, well-finished homes near a business district, with a rooftop garden and a quiet residents' library.",
    location: "Whitefield, Bengaluru",
    address: "Sample Avenue, Whitefield, Bengaluru 560066 (fictional)",
    latitude: 12.9698,
    longitude: 77.75,
    amenities: ["Rooftop garden", "Residents' library", "Gymnasium", "Indoor games room"],
    paymentPlan: [
      { label: "On booking", value: "10%" },
      { label: "On agreement", value: "20%" },
      { label: "During construction", value: "60%" },
      { label: "On possession", value: "10%" },
    ],
    paymentPlanNotes: "Sample terms for demonstration.",
    contactName: "Aurelia Sales (Sample)",
    contactEmail: "aurelia@example.com",
    availabilityStatus: "limited",
    properties: [
      apt("T1-0704", "2BHK", 2, 990, 8_900_000, 7, "available", ["Lake glimpse"]),
      apt("T1-1102", "2BHK", 2, 1010, 9_500_000, 11, "available"),
      apt("T1-1501", "3BHK", 3, 1390, 12_500_000, 15, "available"),
    ],
  },
];

/** Builds a small, valid multi-page PDF so the brochure viewer can be exercised without real collateral. */
export function buildSampleBrochurePdf(developmentName: string): Uint8Array {
  const pages = [
    { title: developmentName, lines: ["Sample brochure", "Fictional content for development and demonstrations only."] },
    { title: "Homes", lines: ["1, 2, 3 and 4 bedroom residences", "Deep balconies and cross-ventilated layouts", "Indicative plans; subject to change"] },
    { title: "Amenities", lines: ["Clubhouse and swimming pool", "Landscaped central garden", "Co-working lounge and gymnasium"] },
    { title: "Specifications", lines: ["Vitrified tile flooring in living areas", "Modular kitchen platform", "Branded sanitary fittings"] },
    { title: "Payment plan", lines: ["10% on booking", "Construction-linked instalments", "10% on possession", "Taxes and charges extra"] },
  ];
  const esc = (t: string) => t.replace(/[^\x20-\x7e]/g, "-").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((p, i) => {
    const pageId = 4 + i * 2;
    const lines = p.lines.map((l, j) => `BT /F1 14 Tf 0.2 0.22 0.21 rg 64 ${560 - j * 26} Td (${esc(l)}) Tj ET`).join("\n");
    const stream = [
      "0.97 0.96 0.94 rg 0 0 595 842 re f",
      "0.07 0.09 0.08 rg 0 700 595 142 re f",
      "0.63 0.49 0.23 RG 1 w 64 640 m 200 640 l S",
      `BT /F1 30 Tf 0.97 0.96 0.94 rg 64 755 Td (${esc(p.title)}) Tj ET`,
      `BT /F1 9 Tf 0.63 0.49 0.23 rg 64 722 Td (SAMPLE - PAGE ${i + 1} OF ${pages.length}) Tj ET`,
      lines,
    ].join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
