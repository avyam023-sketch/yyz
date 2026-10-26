"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TIME_RANGES, TIME_RANGE_LABELS } from "@/lib/domain/constants";
import { todayIn } from "@/lib/domain/dates";
import { residenceName } from "@/lib/domain/residence";
import type { PublicProperty } from "@/lib/types";
import { getSessionId, useTracker } from "./tracker";
import { cn } from "@/lib/utils";

export const VIEWING_CONFIRMATION = "Your viewing request has been received. The property team will contact you to confirm the details.";

export function ViewingRequestForm({
  properties,
  defaultName,
  selectedRef,
  onSelectRef,
  preview,
}: {
  properties: PublicProperty[];
  defaultName: string;
  selectedRef: string;
  onSelectRef: (ref: string) => void;
  preview: boolean;
}) {
  const { track, token } = useTracker();
  const started = useRef(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [range, setRange] = useState<string>("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const available = properties.filter((p) => p.availabilityStatus === "available");
  const today = todayIn("Asia/Kolkata");

  const onFocus = () => {
    if (started.current) return;
    started.current = true;
    track("viewing_request_started");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Please enter your name.";
    if (!phone.trim()) next.phone = "Please enter your mobile number.";
    if (!date) next.preferredDate = "Please choose a date.";
    if (!range) next.timeRange = "Please choose a time of day.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    if (preview || !token) {
      setFormError("Preview mode: requests are not submitted from the agent preview.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/microsites/${token}/viewing-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, preferredDate: date, timeRange: range, propertyRef: selectedRef || "any", message, sessionId: getSessionId() }),
      });
      const json = (await res.json().catch(() => ({}))) as { status?: string; fieldErrors?: Record<string, string>; error?: string };
      if (res.ok && json.status === "submitted") {
        setDone(true);
        return;
      }
      if (json.fieldErrors) setErrors(json.fieldErrors);
      setFormError(json.error ?? (json.fieldErrors ? "Please check the highlighted details." : "We could not send your request. Please try again."));
    } catch {
      setFormError("You appear to be offline. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-[#c8e2d6] bg-emerald-soft p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-8 text-emerald-brand" aria-hidden />
        <p className="mt-3 font-display text-2xl font-semibold text-charcoal">Thank you</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-charcoal/80">{VIEWING_CONFIRMATION}</p>
      </div>
    );
  }

  const fieldClass = "h-11 bg-white text-base sm:text-sm";
  return (
    <form onSubmit={submit} onFocus={onFocus} noValidate className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="vr-name">Your name</Label>
        <Input id="vr-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.name)} />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vr-phone">Mobile / WhatsApp number</Label>
        <Input id="vr-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98123 45678" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.phone)} />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vr-date">Preferred date</Label>
        <Input id="vr-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.preferredDate)} />
        {errors.preferredDate && <p className="text-xs text-destructive">{errors.preferredDate}</p>}
      </div>
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Preferred time</legend>
        <div className="grid grid-cols-3 gap-2">
          {TIME_RANGES.map((t) => (
            <label
              key={t}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-2 text-center text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                range === t ? "border-emerald-brand bg-emerald-soft text-emerald-brand" : "border-input hover:border-[#bdb39f]",
              )}
            >
              <input type="radio" name="timeRange" value={t} checked={range === t} onChange={() => setRange(t)} className="sr-only" />
              {TIME_RANGE_LABELS[t].split(" (")[0]}
            </label>
          ))}
        </div>
        {errors.timeRange && <p className="text-xs text-destructive">{errors.timeRange}</p>}
      </fieldset>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="vr-property">Home you would like to see</Label>
        <select
          id="vr-property"
          value={selectedRef}
          onChange={(e) => onSelectRef(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-white px-3 text-base sm:text-sm"
        >
          <option value="">Any of my selected homes</option>
          {available.map((p) => (
            <option key={p.ref} value={p.ref}>
              {residenceName(p.propertyType, p.unitReference)} · {p.configuration}
            </option>
          ))}
        </select>
        {errors.propertyRef && <p className="text-xs text-destructive">{errors.propertyRef}</p>}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="vr-message">Anything we should know? (optional)</Label>
        <Textarea id="vr-message" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="bg-white text-base sm:text-sm" />
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {formError}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" className="h-12 w-full text-base sm:w-auto sm:px-8" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden />}
          Request a viewing
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">This is a request, not a booking. The team will confirm a time with you.</p>
      </div>
    </form>
  );
}
