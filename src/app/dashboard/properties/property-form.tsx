"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection, inputErrorProps } from "@/components/app/field";
import { MediaUploader } from "@/components/app/media-uploader";
import { PaymentPlanEditor } from "@/components/app/payment-plan-editor";
import { propertySchema, type PropertyInput, type PropertyValues } from "@/lib/validation/schemas";
import {
  AREA_UNITS,
  AREA_UNIT_LABELS,
  CONFIGURATIONS,
  PROPERTY_AVAILABILITY,
  PROPERTY_AVAILABILITY_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
} from "@/lib/domain/constants";
import { formatCompactPrice, parseIndianAmount } from "@/lib/domain/money";
import { saveProperty } from "@/server/actions/catalogue";

function SimpleSelect({ id, value, onChange, options }: { id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PropertyForm({
  id,
  defaults,
  developments,
  mediaPrefix,
  defaultCurrency,
}: {
  id?: string;
  defaults?: Partial<PropertyInput>;
  developments: { id: string; name: string }[];
  mediaPrefix: string;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<PropertyInput, unknown, PropertyValues>({
    resolver: zodResolver(propertySchema),
    mode: "onTouched",
    defaultValues: {
      developmentId: developments.length === 1 ? developments[0].id : "",
      unitReference: "",
      configuration: undefined,
      propertyType: "apartment",
      bedrooms: "",
      bathrooms: "",
      area: "",
      areaUnit: "sqft",
      price: "",
      priceOnRequest: false,
      currency: defaultCurrency,
      floor: "",
      description: "",
      features: "",
      availabilityStatus: "available",
      usesDevelopmentPaymentPlan: true,
      paymentPlan: [],
      floorPlanPath: "",
      imagePaths: [],
      ...defaults,
    },
  });
  const { register, control, formState } = form;
  const err = (name: keyof PropertyInput) => formState.errors[name]?.message as string | undefined;
  const [priceInput, currencyInput, usesDevelopmentPlan] = useWatch({ control, name: ["price", "currency", "usesDevelopmentPaymentPlan"] });
  const price = parseIndianAmount(priceInput ?? null);
  const ownPlan = !usesDevelopmentPlan;

  const onSubmit = form.handleSubmit(() => {
    const raw = form.getValues();
    startTransition(async () => {
      const result = await saveProperty(id ?? null, raw);
      if (!result.ok) {
        toast.error(result.error);
        for (const [f, m] of Object.entries(result.fieldErrors ?? {})) form.setError(f as keyof PropertyInput, { message: m });
        return;
      }
      toast.success(result.message ?? "Saved");
      router.push(`/dashboard/properties/${result.data.id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border border-border bg-card px-6 py-8 sm:px-8">
      <FormSection title="Unit" description="Matching uses development, configuration, availability and price.">
        <Field id="developmentId" label="Development" required error={err("developmentId")}>
          <Controller control={control} name="developmentId" render={({ field }) => <SimpleSelect id="developmentId" value={field.value} onChange={field.onChange} options={developments.map((d) => ({ value: d.id, label: d.name }))} />} />
        </Field>
        <Field id="unitReference" label="Unit reference" required error={err("unitReference")}>
          <Input id="unitReference" placeholder="e.g. A-1204" {...register("unitReference")} {...inputErrorProps("unitReference", err("unitReference"))} />
        </Field>
        <Field id="configuration" label="Configuration" required error={err("configuration")}>
          <Controller control={control} name="configuration" render={({ field }) => <SimpleSelect id="configuration" value={field.value ?? ""} onChange={field.onChange} options={CONFIGURATIONS.map((c) => ({ value: c, label: c }))} />} />
        </Field>
        <Field id="propertyType" label="Property type" error={err("propertyType")}>
          <Controller control={control} name="propertyType" render={({ field }) => <SimpleSelect id="propertyType" value={field.value ?? "apartment"} onChange={field.onChange} options={PROPERTY_TYPES.map((t) => ({ value: t, label: PROPERTY_TYPE_LABELS[t] }))} />} />
        </Field>
        <Field id="availabilityStatus" label="Availability" error={err("availabilityStatus")} hint="Only available units are suggested or priced on microsites.">
          <Controller control={control} name="availabilityStatus" render={({ field }) => <SimpleSelect id="availabilityStatus" value={field.value ?? "available"} onChange={field.onChange} options={PROPERTY_AVAILABILITY.map((s) => ({ value: s, label: PROPERTY_AVAILABILITY_LABELS[s] }))} />} />
        </Field>
        <Field id="floor" label="Floor" error={err("floor")}>
          <Input id="floor" inputMode="numeric" {...register("floor")} {...inputErrorProps("floor", err("floor"))} />
        </Field>
        <Field id="bedrooms" label="Bedrooms" error={err("bedrooms")}>
          <Input id="bedrooms" inputMode="numeric" {...register("bedrooms")} {...inputErrorProps("bedrooms", err("bedrooms"))} />
        </Field>
        <Field id="bathrooms" label="Bathrooms" error={err("bathrooms")}>
          <Input id="bathrooms" inputMode="numeric" {...register("bathrooms")} {...inputErrorProps("bathrooms", err("bathrooms"))} />
        </Field>
        <Field id="area" label="Area" error={err("area")}>
          <div className="flex gap-2">
            <Input id="area" inputMode="decimal" {...register("area")} {...inputErrorProps("area", err("area"))} />
            <Controller
              control={control}
              name="areaUnit"
              render={({ field }) => (
                <Select value={field.value ?? "sqft"} onValueChange={field.onChange}>
                  <SelectTrigger className="w-24" aria-label="Area unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREA_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {AREA_UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </Field>
        <Field id="price" label="Price" error={err("price")} hint={price !== null && !Number.isNaN(price) ? `= ${formatCompactPrice(price, String(currencyInput ?? "INR").toUpperCase())}` : "e.g. 92L or 1.15Cr. Leave empty for price on request."}>
          <div className="flex gap-2">
            <Input id="price" {...register("price")} {...inputErrorProps("price", err("price"))} />
            <Input aria-label="Currency" className="w-20 uppercase" maxLength={3} {...register("currency")} />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-3 text-sm">
            <Controller control={control} name="priceOnRequest" render={({ field }) => <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
            Show buyers &ldquo;Price on request&rdquo;
          </label>
          <p className="mt-1.5 text-xs text-muted-foreground">The price above stays visible to your team and is still used for budget matching. Buyers never see it.</p>
        </div>
        <Field id="description" label="Description" error={err("description")} className="sm:col-span-2">
          <Textarea id="description" rows={4} {...register("description")} />
        </Field>
        <Field id="features" label="Features" hint="One per line or comma-separated" error={err("features")} className="sm:col-span-2">
          <Textarea id="features" rows={3} placeholder={"East facing\nPark view\nTwo covered parking spaces"} {...register("features")} />
        </Field>
      </FormSection>

      <FormSection title="Payment plan" description="Most units follow the development's plan.">
        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <Controller control={control} name="usesDevelopmentPaymentPlan" render={({ field }) => <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
          Use the development&apos;s payment plan
        </label>
        {ownPlan && (
          <div className="sm:col-span-2">
            <PaymentPlanEditor control={control as never} register={register as never} errors={formState.errors} />
          </div>
        )}
      </FormSection>

      <FormSection title="Media" description="Floor plans may be images or PDF.">
        <Field id="floorPlan" label="Floor plan" className="sm:col-span-2">
          <Controller
            control={control}
            name="floorPlanPath"
            render={({ field }) => (
              <MediaUploader kind="floor-plans" allowPdf mediaPrefix={mediaPrefix} value={field.value ? [field.value] : []} onChange={(p) => field.onChange(p[0] ?? "")} label="Upload floor plan" />
            )}
          />
        </Field>
        <Field id="images" label="Property images" className="sm:col-span-2">
          <Controller control={control} name="imagePaths" render={({ field }) => <MediaUploader kind="images" multiple mediaPrefix={mediaPrefix} value={field.value ?? []} onChange={field.onChange} />} />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {id ? "Save changes" : "Create property"}
        </Button>
      </div>
    </form>
  );
}
