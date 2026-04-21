import type { ReactNode } from "react";
import Link from "next/link";
import { PublicHeader } from "./public-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AuthHighlight = {
  title: string;
  description: string;
};

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  highlights?: AuthHighlight[];
  spotlight?: ReactNode;
};

const defaultHighlights: AuthHighlight[] = [
  {
    title: "Bireysel",
    description:
      "Bagimsiz uzman, hekim, DSP ve bireysel profesyoneller icin hizli baslangic akisi.",
  },
  {
    title: "OSGB",
    description:
      "Firma, personel, gorevlendirme ve is takibini tek panelde toplayan ekip modeli.",
  },
  {
    title: "Kurumsal",
    description:
      "Cok lokasyonlu ve ozel ihtiyacli yapilar icin iletisim odakli enterprise akis.",
  },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  highlights = defaultHighlights,
  spotlight,
}: AuthShellProps) {
  return (
    <main className="app-shell">
      <PublicHeader />

      <section className="page-shell py-8 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden border-transparent bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_30%),linear-gradient(135deg,#0F172A_0%,#1E293B_50%,#0F172A_75%)] text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <CardHeader className="gap-4 p-8 sm:p-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/risknova-symbol-only.svg" alt="" className="h-16 w-16 opacity-90" />
              <Badge className="w-fit border-amber-500/20 bg-amber-500/12 text-amber-200">
                {eyebrow}
              </Badge>

              <div className="space-y-3">
                <CardTitle className="text-3xl leading-tight text-white sm:text-4xl">
                  {title}
                </CardTitle>

                <CardDescription className="max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
                  {description}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-8 px-8 pb-8 sm:px-10 sm:pb-10">
              <div className="grid gap-3 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-amber-500/15 bg-white/8 p-4 text-sm leading-6 text-white backdrop-blur-sm"
                  >
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="mt-1 text-white/82">{item.description}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-amber-500/10 bg-black/20 p-5">
                {spotlight ?? (
                  <p className="text-sm leading-7 text-white/92">
                    RiskNova, yalnizca bir panel degil; risk analizi, saha
                    operasyonu, dokuman akislari ve ekip koordinasyonunu tek urun
                    dili icinde birlestiren profesyonel bir ISG altyapisidir.
                  </p>
                )}

                <div className="mt-4">
                  <Link
                    href="/"
                    className="text-sm font-medium text-amber-200 underline underline-offset-4"
                  >
                    Ana sayfaya don
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="self-stretch">
            <CardHeader className="p-8 pb-4 sm:p-10 sm:pb-6">
              <Badge variant="accent" className="w-fit">
                Guvenli erisim
              </Badge>

              <div className="space-y-2">
                <CardTitle className="text-2xl sm:text-3xl">{title}</CardTitle>
                <CardDescription className="max-w-xl text-sm leading-7 sm:text-base">
                  {description}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-8 pb-8 sm:px-10 sm:pb-10">
              {children}

              <div className="border-t border-border pt-5">{footer}</div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
