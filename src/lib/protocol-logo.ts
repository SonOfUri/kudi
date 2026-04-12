/**
 * Maps Li.fi Earn `protocol.name` (e.g. morpho-v1, aave-v3) to files in /public/protocols/.
 */
export function protocolLogoPath(protocolName: string | undefined): string | null {
  if (!protocolName) return null;
  const id = protocolName.toLowerCase().trim();
  if (id.includes("morpho")) return "/protocols/morpho.jpeg";
  if (id.includes("aave")) return "/protocols/aave.svg";
  if (id.includes("pendle")) return "/protocols/pendle.jpeg";
  if (id.includes("euler")) return "/protocols/euler.svg";
  if (id.includes("yo-protocol") || id === "yo" || id.startsWith("yo-")) return "/protocols/yo.svg";
  return null;
}
