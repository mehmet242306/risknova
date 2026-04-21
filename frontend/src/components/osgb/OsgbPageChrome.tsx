import Link from "next/link";
import type { ReactNode } from "react";
import type { OsgbCompanyOption } from "@/lib/osgb/server";

type ScopeBarProps = {
  companies: OsgbCompanyOption[];
  selectedWorkspaceId?: string | null;
  basePath: string;
};

export function OsgbScopeBar({
  companies,
  selectedWorkspaceId,
  basePath,
}: ScopeBarProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Firma kapsami
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            OSGB yonetim ekranlari firma secimiyle filtrelenir. Secili firma olmadiginda tum portfoy gorunur.
          </p>
        </div>
        <Link
          href={basePath}
          className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium transition-colors ${
            !selectedWorkspaceId
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-secondary"
          }`}
        >
          Tum firmalar
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {companies.map((company) => {
          const href = `${basePath}?workspaceId=${company.workspaceId}`;
          const active = selectedWorkspaceId === company.workspaceId;
          return (
            <Link
              key={company.workspaceId}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <span>{company.displayName}</span>
              {company.hazardClass ? (
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {company.hazardClass}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function OsgbStatCard({
  title,
  value,
  description,
  accent = "text-foreground",
}: {
  title: string;
  value: string | number;
  description: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <p className={`mt-3 text-3xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export function OsgbPanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function OsgbEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background/80 px-6 py-10 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
