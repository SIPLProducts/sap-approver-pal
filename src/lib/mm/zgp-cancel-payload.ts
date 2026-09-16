import { z } from "zod";

const requiredString = z.string().trim().min(1);

const zgpCancelPayloadSchema = z.object({
  cancel: z.object({
    user_name: requiredString,
    type_from: z.string(),
    type_to: z.string(),
    number_from: z.string(),
    number_to: z.string(),
    material_from: z.string(),
    material_to: z.string(),
    date_from: z.string(),
    date_to: z.string(),
    plant_from: z.string(),
    plant_to: z.string(),
    vendor_from: z.string(),
    vendor_to: z.string(),
    type: z.any(),
    unique: z.any(),
    material: z.any(),
    DESCRIPTION: z.any(),
  }),
});

type ZgpCancelFilters = {
  type_from?: string;
  type_to?: string;
  number_from?: string;
  number_to?: string;
  material_from?: string;
  material_to?: string;
  date_from?: string;
  date_to?: string;
  plant_from?: string;
  plant_to?: string;
  vendor_from?: string;
  vendor_to?: string;
};

export function buildZgpCancelPayload(
  userName: string,
  filters: ZgpCancelFilters,
  row: Record<string, unknown>,
) {
  return zgpCancelPayloadSchema.parse({
    cancel: {
      user_name: userName.trim(),
      type_from: (filters.type_from ?? "").trim(),
      type_to: (filters.type_to ?? "").trim(),
      number_from: (filters.number_from ?? "").trim(),
      number_to: (filters.number_to ?? "").trim(),
      material_from: (filters.material_from ?? "").trim(),
      material_to: (filters.material_to ?? "").trim(),
      date_from: (filters.date_from ?? "").trim(),
      date_to: (filters.date_to ?? "").trim(),
      plant_from: (filters.plant_from ?? "").trim(),
      plant_to: (filters.plant_to ?? "").trim(),
      vendor_from: (filters.vendor_from ?? "").trim(),
      vendor_to: (filters.vendor_to ?? "").trim(),
      type: row.TYPE ?? "",
      unique: row.UNIQUE_NO ?? "",
      material: row.MATERIAL ?? "",
      DESCRIPTION: row.DESCRIPTION ?? "",
    },
  });
}