import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { fetchHighestApyMarketVault } from "@/lib/lifi/server";

import { SimulationContent } from "./simulation-content";

export default async function SimulationPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  let top: Awaited<ReturnType<typeof fetchHighestApyMarketVault>> = null;
  let fetchError: string | null = null;

  try {
    top = await fetchHighestApyMarketVault();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Could not load Markets data";
  }

  return (
    <SimulationContent
      topVaultApy={top?.apy ?? 0}
      topVaultName={top?.name}
      fetchError={fetchError}
    />
  );
}
