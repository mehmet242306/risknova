"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Building2, CheckCircle2, Globe2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommercialLeadDialog } from "@/components/auth/CommercialLeadDialog";
import { type CommercialInterestType } from "@/lib/account/register-offers";

type AccountType = "individual" | "osgb" | "enterprise";

type RegisterAccountTypePreviewProps = {
  children: ReactNode;
};

const accountCards: Array<{
  value: AccountType;
  title: string;
  description: string;
  note: string;
  icon: typeof UserRound;
}> = [
  {
    value: "individual",
    title: "Bireysel",
    description: "Uzman, hekim, DSP veya bireysel profesyonel olarak hemen hesap olustur.",
    note: "Self-service kayit. Sonraki adimda rol ve calisma alani tamamlanir.",
    icon: UserRound,
  },
  {
    value: "osgb",
    title: "OSGB",
    description: "Firma portfoyu, ekip ve gorevlendirme yoneten OSGB yapilari icin.",
    note: "Gelistirici ile iletisim akisi. Paket ve kurulum ihtiyaci birlikte netlesir.",
    icon: Building2,
  },
  {
    value: "enterprise",
    title: "Firma / Kurumsal",
    description: "Cok lokasyonlu veya ozel ihtiyacli firma ve kurum yapilari icin.",
    note: "Self-service yerine kisa iletisim formu ile size uygun kurulum planlanir.",
    icon: Globe2,
  },
];

const countryOptions = [
  { code: "TR", label: "Turkiye" },
  { code: "AZ", label: "Azerbaycan" },
  { code: "DE", label: "Almanya" },
  { code: "GB", label: "Birlesik Krallik" },
  { code: "US", label: "ABD" },
];

const languageOptions = [
  { code: "tr", label: "Turkce" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "az", label: "Azerbaycanca" },
];

export function RegisterAccountTypePreview({ children }: RegisterAccountTypePreviewProps) {
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [countryCode, setCountryCode] = useState("TR");
  const [languageCode, setLanguageCode] = useState("tr");
  const [activeLeadType, setActiveLeadType] =
    useState<CommercialInterestType | null>(null);

  const selectedAccount = useMemo(
    () => accountCards.find((item) => item.value === accountType) ?? accountCards[0],
    [accountType],
  );
  const selectedCountry = countryOptions.find((item) => item.code === countryCode);
  const selectedLanguage = languageOptions.find((item) => item.code === languageCode);

  return (
    <>
      <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-3 sm:p-4">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Hesap turu ve bolge secimi
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Ulke secimi mevzuat, RAG ve dil ayarlarinin temelini olusturur.
          </p>
        </div>

        <div className="grid gap-2">
          {accountCards.map((item) => {
            const Icon = item.icon;
            const active = item.value === accountType;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setAccountType(item.value)}
                className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/8 ring-1 ring-primary/20"
                    : "border-border bg-card hover:border-primary/35 hover:bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {item.title}
                      {active ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </span>
                    <span className="mt-2 block text-[11px] font-medium leading-5 text-primary">
                      {item.note}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-foreground">
            <span>Bolge / ulke</span>
            <select
              name="countryCode"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {countryOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-xs font-semibold text-foreground">
            <span>Dil</span>
            <select
              name="languageCode"
              value={languageCode}
              onChange={(event) => setLanguageCode(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {languageOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Secim: <span className="font-semibold text-foreground">{selectedAccount.title}</span>
          {" / "}
          <span className="font-semibold text-foreground">{selectedCountry?.label}</span>
          {" / "}
          <span className="font-semibold text-foreground">{selectedLanguage?.label}</span>
        </div>
      </div>

      {accountType === "individual" ? (
        <div className="space-y-5">
          <input form="register-individual-form" type="hidden" name="accountType" value="individual" />
          <input form="register-individual-form" type="hidden" name="countryCode" value={countryCode} />
          <input form="register-individual-form" type="hidden" name="languageCode" value={languageCode} />
          {children}
        </div>
      ) : (
        <div className="rounded-3xl border border-primary/20 bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="text-sm font-semibold text-foreground">
            {accountType === "osgb" ? "OSGB icin kurulum gorusmesi" : "Firma / kurumsal kurulum gorusmesi"}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Bu hesap turunde once yapinizi taniyoruz. Secilen bolge ve dil ile birlikte
            gelistirici ekibe kisa bir talep birakabilirsiniz.
          </p>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={() => setActiveLeadType(accountType === "osgb" ? "osgb" : "enterprise")}
          >
            Gelistirici ile iletisime gec
          </Button>
        </div>
      )}

      <CommercialLeadDialog
        accountType={activeLeadType ?? "enterprise"}
        open={activeLeadType !== null}
        onClose={() => setActiveLeadType(null)}
        countryCode={countryCode}
        languageCode={languageCode}
      />
    </>
  );
}
