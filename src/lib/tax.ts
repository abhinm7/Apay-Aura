// Aura tax: transfers of the threshold or more pay a flat % of the whole amount.
// The sender is debited the full amount; the receiver gets amount - tax.
export const TAX_THRESHOLD = 10_000;
export const TAX_PERCENT = 1;

export function auraTax(amount: number) {
  return amount >= TAX_THRESHOLD ? Math.floor((amount * TAX_PERCENT) / 100) : 0;
}
