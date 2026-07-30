import createDebug from "debug";

export const debug = createDebug("napplet");

export function shortId(value: string | null | undefined): string {
  if (!value) return "none";
  return value.length <= 12
    ? value
    : `${value.slice(0, 8)}...${value.slice(-4)}`;
}
