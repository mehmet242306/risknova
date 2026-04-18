"use client";

import { IshikawaDiagram, type IshikawaData } from "./IshikawaDiagram";

type FishboneCategoryKey = "insan" | "makine" | "metot" | "malzeme" | "olcum" | "cevre";

type FishboneData = {
  analysis_summary?: string;
  primary_root_cause?: string;
  severity_assessment?: string;
  categories: Record<FishboneCategoryKey, string[]>;
};

export function IshikawaFishboneDiagram({ data }: { data: FishboneData }) {
  // Turkish-key data → English-key IshikawaData
  const adapted: IshikawaData = {
    problemStatement: data.analysis_summary || data.primary_root_cause || "Olay / Problem Tanimi",
    manCauses: data.categories.insan ?? [],
    machineCauses: data.categories.makine ?? [],
    methodCauses: data.categories.metot ?? [],
    materialCauses: data.categories.malzeme ?? [],
    environmentCauses: data.categories.cevre ?? [],
    measurementCauses: data.categories.olcum ?? [],
  };

  return <IshikawaDiagram data={adapted} />;
}
