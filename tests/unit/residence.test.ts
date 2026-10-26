import { describe, expect, it } from "vitest";
import { residenceHeadline, residenceName } from "@/lib/domain/residence";

describe("residenceName", () => {
  it("leads with the residence, not the configuration", () => {
    expect(residenceName("apartment", "A-0802")).toBe("Residence A-0802");
    expect(residenceName("penthouse", "B-2101")).toBe("Penthouse B-2101");
    expect(residenceName("villa", "V-07")).toBe("Villa V-07");
    expect(residenceName("unknown", "X-1")).toBe("Residence X-1");
  });
});

describe("residenceHeadline", () => {
  it("uses the first two features", () => {
    expect(residenceHeadline(["East facing", "Garden view", "Two balconies"])).toBe("East facing · Garden view");
    expect(residenceHeadline(["Panoramic view"])).toBe("Panoramic view");
    expect(residenceHeadline([])).toBeNull();
  });
});
