import type { PropertyType } from "./constants";

const RESIDENCE_NOUNS: Partial<Record<PropertyType, string>> = {
  villa: "Villa",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  plot: "Plot",
};

/** Buyer-facing name: "Residence A-0802", "Penthouse B-2101". Specs are shown separately. */
export function residenceName(propertyType: string, unitReference: string): string {
  return `${RESIDENCE_NOUNS[propertyType as PropertyType] ?? "Residence"} ${unitReference}`;
}

/** The line under the name, from the first features the team listed (usually aspect and view). */
export function residenceHeadline(features: string[]): string | null {
  const lead = features.slice(0, 2).filter((f) => f.trim());
  return lead.length ? lead.join(" · ") : null;
}
