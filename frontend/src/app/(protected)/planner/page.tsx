import type { Metadata } from "next";
import PlannerTabsShell from "./PlannerTabsShell";

export const metadata: Metadata = {
  title: "Planlayıcı | RiskNova",
};

export default function PlannerPage() {
  return <PlannerTabsShell />;
}
