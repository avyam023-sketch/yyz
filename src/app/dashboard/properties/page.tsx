import type { Metadata } from "next";
import Link from "next/link";
import { Home, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination } from "@/components/app/pagination";
import { PropertyAvailabilityBadge, SampleBadge } from "@/components/app/status-badges";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAuth } from "@/server/auth";
import { developmentOptions, listProperties } from "@/server/data/catalogue";
import { CONFIGURATIONS, PROPERTY_AVAILABILITY, PROPERTY_AVAILABILITY_LABELS } from "@/lib/domain/constants";
import { formatArea, formatCompactPrice } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Properties" };

type Search = { q?: string; development?: string; configuration?: string; availability?: string; page?: string; view?: string };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const archived = sp.view === "archived";
  const [result, developments] = await Promise.all([
    listProperties(ctx, {
      q: sp.q,
      developmentId: sp.development,
      configuration: CONFIGURATIONS.includes(sp.configuration as never) ? sp.configuration : undefined,
      availability: PROPERTY_AVAILABILITY.includes(sp.availability as never) ? sp.availability : undefined,
      archived,
      page: Number(sp.page) || 1,
    }),
    developmentOptions(ctx),
  ]);
  const filtered = Boolean(sp.q || sp.development || sp.configuration || sp.availability);

  return (
    <>
      <PageHeader
        title="Properties"
        description="Your catalogue is the single source of truth: price and availability changes show on every microsite automatically."
        actions={
          <Link href="/dashboard/properties/new" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden /> Add property
          </Link>
        }
      />
      <div className="mb-4 flex gap-4 border-b border-border text-sm">
        {[
          { label: "Active", href: "/dashboard/properties", on: !archived },
          { label: "Archived", href: "/dashboard/properties?view=archived", on: archived },
        ].map((t) => (
          <Link key={t.label} href={t.href} className={cn("-mb-px border-b-2 px-1 pb-2.5 font-medium", t.on ? "border-emerald-brand" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </div>
      <FilterBar
        searchPlaceholder="Search unit reference"
        selects={[
          { name: "development", label: "Development", allLabel: "All developments", options: developments.map((d) => ({ value: d.id, label: d.name })) },
          { name: "configuration", label: "Configuration", allLabel: "All configurations", options: CONFIGURATIONS.map((c) => ({ value: c, label: c })) },
          { name: "availability", label: "Availability", allLabel: "Any availability", options: PROPERTY_AVAILABILITY.map((s) => ({ value: s, label: PROPERTY_AVAILABILITY_LABELS[s] })) },
        ]}
      />
      {result.properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title={filtered ? "No properties match these filters" : archived ? "No archived properties" : "No properties yet"}
          description={filtered || archived ? undefined : developments.length ? "Add units with configuration, price and availability." : "Add a development first, then its units."}
          action={
            !filtered && !archived ? (
              <Link href={developments.length ? "/dashboard/properties/new" : "/dashboard/developments/new"} className={buttonVariants()}>
                {developments.length ? "Add property" : "Add development"}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Unit</TableHead>
                  <TableHead>Development</TableHead>
                  <TableHead>Configuration</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.properties.map((p) => (
                  <TableRow key={p.id} className="text-sm">
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/properties/${p.id}`} className="hover:text-emerald-brand hover:underline">
                        {p.unitReference}
                      </Link>
                      {p.isSample && <SampleBadge className="ml-2" />}
                    </TableCell>
                    <TableCell>{p.developmentName}</TableCell>
                    <TableCell>{p.configuration}</TableCell>
                    <TableCell className="text-muted-foreground">{formatArea(p.area, p.areaUnit)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.floor ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompactPrice(p.price, p.currency)}
                      {p.priceOnRequest && p.price !== null && <div className="text-xs text-muted-foreground">On request to buyers</div>}
                    </TableCell>
                    <TableCell>
                      <PropertyAvailabilityBadge status={p.availabilityStatus} archived={Boolean(p.archivedAt)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/dashboard/properties" params={{ q: sp.q, development: sp.development, configuration: sp.configuration, availability: sp.availability, view: sp.view }} />
    </>
  );
}
