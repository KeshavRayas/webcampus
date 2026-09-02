export type TermType = "even" | "odd" | "supplementary";
export type TermParity = "odd" | "even";

export function getTermLabel(
  type: string,
  year: string,
  parity?: string | null
): string {
  if (type === "supplementary" && (parity === "odd" || parity === "even")) {
    return `${parity === "odd" ? "Odd" : "Even"} Supplementary ${year}`;
  }
  return `${type.charAt(0).toUpperCase()}${type.slice(1)} ${year}`;
}
