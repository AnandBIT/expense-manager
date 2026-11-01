export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

// The largest expense, in minor units. firestore.rules rejects anything bigger;
// a unit test checks the two stay the same.
export const MAX_AMOUNT = 100_000_000_000;

export function fractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

// Parses text like "1,250.50" into minor units. Returns null for anything that
// isn't a plain non-negative number with at most the currency's decimals.
export function parseAmount(text: string, currency: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  const digits = fractionDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!pattern.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

// Parses "33.33" into basis points (3333). Returns null if invalid or over 100%.
export function parsePercent(text: string): number | null {
  const cleaned = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");
  return basisPoints <= 10000 ? basisPoints : null;
}

export function formatMoney(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  const isWhole = minor % 10 ** digits === 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: isWhole ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}

// The plain number a user would type for this amount, e.g. 12550 → "125.5".
export function amountToInput(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  return String(minor / 10 ** digits);
}

export function percentToInput(basisPoints: number): string {
  return String(basisPoints / 100);
}
