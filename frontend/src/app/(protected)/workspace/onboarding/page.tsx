import { WorkspaceOnboardingClient } from "./WorkspaceOnboardingClient";

export default async function WorkspaceOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; passwordUpdated?: string }>;
}) {
  const params = await searchParams;
  return (
    <WorkspaceOnboardingClient
      nextPath={params.next}
      initialMessage={
        params.passwordUpdated === "1"
          ? "Sifren kaydedildi. Devam etmek icin ulke ve rol secimini tamamla."
          : undefined
      }
    />
  );
}
