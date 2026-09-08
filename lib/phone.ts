/**
 * STM phone rule:
 *   starts with 0   -> "+2"  prefix   (01001234567 -> +201001234567)
 *   no leading 0    -> "+20" prefix   ( 1001234567 -> +201001234567)
 *   already +  / 00 -> left alone
 */
export function normalizePhone(raw: string): string {
  const phone = String(raw ?? "").trim();
  if (!phone) return "";
  if (phone.startsWith("+")) return phone;
  if (phone.startsWith("00")) return "+" + phone.slice(2);
  if (phone.startsWith("0")) return "+2" + phone;
  return "+20" + phone;
}

/** Excel turns 01001234567 into a number and eats the leading zero. */
export function lostLeadingZero(raw: string): boolean {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("1");
}
