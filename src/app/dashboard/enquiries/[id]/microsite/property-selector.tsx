"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Info, Loader2, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatArea, formatCompactPrice } from "@/lib/domain/money";
import { MAX_MICROSITE_PROPERTIES, MICROSITE_EXPIRY_OPTIONS } from "@/lib/domain/constants";
import type { BudgetFit, MatchTier } from "@/lib/domain/matching";
import { generateMicrosite, updateMicrositeSelection } from "@/server/actions/microsites";
import { cn } from "@/lib/utils";

export interface SelectableProperty {
  id: string;
  unitReference: string;
  configuration: string;
  developmentName: string;
  price: number | null;
  priceOnRequest: boolean;
  currency: string;
  area: number | null;
  areaUnit: string;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  imagePath: string | null;
  hasFloorPlan: boolean;
  tier: MatchTier;
  budget: BudgetFit;
  developmentMatch: boolean;
  configurationMatch: boolean;
  reasons: string[];
}

const BUDGET_LABEL: Record<BudgetFit, { text: string; tone: string }> = {
  within: { text: "Within budget", tone: "text-emerald-brand bg-emerald-soft" },
  not_specified: { text: "No budget set", tone: "text-muted-foreground bg-muted" },
  above: { text: "Above budget", tone: "text-[#8a4b12] bg-[#fbf0e3]" },
  below: { text: "Below budget minimum", tone: "text-[#2f4a63] bg-[#eef2f6]" },
  unknown: { text: "Budget fit unknown", tone: "text-muted-foreground bg-muted" },
};

function ReasonIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  return ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-brand" aria-hidden /> : <X className="mt-0.5 size-3.5 shrink-0 text-[#a15c1c]" aria-hidden />;
}

function PropertyOption({ p, checked, onToggle, disabled }: { p: SelectableProperty; checked: boolean; onToggle: () => void; disabled: boolean }) {
  const budgetOk = p.budget === "within" ? true : p.budget === "not_specified" || p.budget === "unknown" ? null : false;
  const flags = [p.developmentMatch, p.configurationMatch, budgetOk];
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-4 rounded-xl border bg-card p-4 transition-colors",
        checked ? "border-emerald-brand ring-1 ring-emerald-brand/30" : "border-border hover:border-[#cfc6b5]",
        disabled && !checked && "cursor-not-allowed opacity-60",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} disabled={disabled && !checked} className="mt-1" aria-label={`Select ${p.unitReference}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="text-sm font-semibold">
            {p.configuration} · Unit {p.unitReference}
            {!p.developmentMatch && <span className="ml-2 text-xs font-normal text-muted-foreground">{p.developmentName}</span>}
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-semibold tabular-nums">{formatCompactPrice(p.price, p.currency)}</div>
            {p.priceOnRequest && p.price !== null && <div className="text-xs text-muted-foreground">Buyer sees &ldquo;Price on request&rdquo;</div>}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{formatArea(p.area, p.areaUnit)}</span>
          {p.floor !== null && <span>Floor {p.floor}</span>}
          {p.bedrooms !== null && <span>{p.bedrooms} bed</span>}
          {p.bathrooms !== null && <span>{p.bathrooms} bath</span>}
          <span>{p.hasFloorPlan ? "Floor plan uploaded" : "No floor plan yet"}</span>
        </div>
        <ul className="mt-3 space-y-1">
          {p.reasons.map((r, i) => (
            <li key={r} className="flex gap-1.5 text-xs text-foreground/80">
              <ReasonIcon ok={flags[i] ?? null} />
              {r}
            </li>
          ))}
        </ul>
        <span className={cn("mt-3 inline-block rounded px-2 py-0.5 text-[0.7rem] font-medium", BUDGET_LABEL[p.budget].tone)}>{BUDGET_LABEL[p.budget].text}</span>
      </div>
    </label>
  );
}

function Section({
  title,
  description,
  items,
  selected,
  onToggle,
  atLimit,
}: {
  title: string;
  description: string;
  items: SelectableProperty[];
  selected: string[];
  onToggle: (id: string) => void;
  atLimit: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((p) => (
          <PropertyOption key={p.id} p={p} checked={selected.includes(p.id)} onToggle={() => onToggle(p.id)} disabled={atLimit} />
        ))}
      </div>
    </section>
  );
}

export function PropertySelector(props: {
  leadId: string;
  buyerFirstName: string;
  configuration: string;
  developmentName: string;
  budgetLabel: string;
  exact: SelectableProperty[];
  close: SelectableProperty[];
  other: SelectableProperty[];
  unavailableExcluded: number;
  noLongerAvailable: string[];
  initialSelection: string[];
  existing: { micrositeId: string; introMessage: string; showBuyerName: boolean } | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(props.initialSelection);
  const [expiry, setExpiry] = useState("60");
  const [intro, setIntro] = useState(props.existing?.introMessage ?? "");
  const [showName, setShowName] = useState(props.existing?.showBuyerName ?? true);
  const [confirmNew, setConfirmNew] = useState(false);
  const [pending, startTransition] = useTransition();

  const all = useMemo(() => [...props.exact, ...props.close, ...props.other], [props.exact, props.close, props.other]);
  const tiers = useMemo(() => Object.fromEntries(all.map((p) => [p.id, p.tier])), [all]);
  const atLimit = selected.length >= MAX_MICROSITE_PROPERTIES;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // Keep the order agents see on screen: exact matches first.
  const ordered = all.map((p) => p.id).filter((id) => selected.includes(id));

  function generate() {
    setConfirmNew(false);
    startTransition(async () => {
      const result = await generateMicrosite({
        leadId: props.leadId,
        propertyIds: ordered,
        matchTiers: tiers,
        expiry: expiry as "30" | "60" | "90" | "never",
        introMessage: intro,
        showBuyerName: showName,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Microsite generated");
      router.push(`/dashboard/enquiries/${props.leadId}?shared=new`);
      router.refresh();
    });
  }

  function update() {
    startTransition(async () => {
      const result = await updateMicrositeSelection(props.existing!.micrositeId, ordered, tiers);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Microsite updated");
      router.push(`/dashboard/enquiries/${props.leadId}`);
      router.refresh();
    });
  }


  const nothing = all.length === 0;

  return (
    <div className="pb-40">
      {props.exact.length === 0 && (
        <div role="status" className="mb-8 flex gap-3 rounded-xl border border-[#ecd9b8] bg-brass-soft p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
          <div>
            <p className="font-medium">No exact match</p>
            <p className="mt-0.5 text-muted-foreground">
              There is no available {props.configuration} in {props.developmentName} within {props.budgetLabel}.
              {nothing ? " Nothing in the catalogue comes close either." : " The closest alternatives are below. Each one says how it differs, so you can decide what to share."}
            </p>
          </div>
        </div>
      )}
      {props.noLongerAvailable.length > 0 && (
        <div role="status" className="mb-8 flex gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            No longer available and will be removed when you save: <span className="text-foreground">{props.noLongerAvailable.join(", ")}</span>.
          </p>
        </div>
      )}

      <Section title={`Exact matches (${props.exact.length})`} description={`${props.configuration} in ${props.developmentName}, available, within budget.`} items={props.exact} selected={selected} onToggle={toggle} atLimit={atLimit} />
      <Section title={`Close alternatives (${props.close.length})`} description={`In ${props.developmentName}, but the configuration or price differs.`} items={props.close} selected={selected} onToggle={toggle} atLimit={atLimit} />
      <Section title={`Other developments (${props.other.length})`} description={`${props.configuration} within budget in your other developments.`} items={props.other} selected={selected} onToggle={toggle} atLimit={atLimit} />
      {props.unavailableExcluded > 0 && (
        <p className="text-xs text-muted-foreground">
          {props.unavailableExcluded} reserved, sold or archived {props.unavailableExcluded === 1 ? "property was" : "properties were"} left out.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-8 lg:flex-row lg:items-end">
          {!props.existing && (
            <div className="grid flex-1 gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="expiry" className="text-xs">
                  Link expires after
                </Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger id="expiry" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MICROSITE_EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intro" className="text-xs">
                  Personal note on the page (optional)
                </Label>
                <Textarea id="intro" rows={1} maxLength={600} value={intro} onChange={(e) => setIntro(e.target.value)} className="min-h-8 resize-none" placeholder="e.g. Both homes face the park, as you mentioned." />
              </div>
              <label className="flex items-center gap-2 pb-1.5 text-xs">
                <Switch checked={showName} onCheckedChange={setShowName} aria-label="Greet the buyer by first name" />
                Greet as “{props.buyerFirstName}”
              </label>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {selected.length} of {MAX_MICROSITE_PROPERTIES} max selected
            </span>
            {props.existing ? (
              <>
                <Button variant="outline" disabled={pending || selected.length === 0} onClick={() => setConfirmNew(true)}>
                  Issue a new link instead
                </Button>
                <Button size="lg" disabled={pending || selected.length === 0} onClick={update}>
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  Update microsite
                </Button>
              </>
            ) : (
              <Button size="lg" disabled={pending || selected.length === 0} onClick={generate}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Generate Personalised Microsite
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue a new link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current link will be revoked immediately and show an expired-link page. Use this if the old link was shared with the wrong
              person. To just change the homes shown, use “Update microsite” instead; the existing link keeps working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={generate}>Revoke old link and generate new</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
