/**
 * Utility functions for parsing, formatting and suggesting 'কতটুকু' (amount / weight / size)
 * for items in the Cash Memo.
 */

export const COMMON_AMOUNT_PRESETS = [
  '১০০ গ্রাম',
  '২৫০ গ্রাম',
  '৫০০ গ্রাম',
  '১ কেজি',
  '২ কেজি',
  '৫ কেজি',
  '২৫ কেজি',
  '২৫০ মিলি',
  '৫০০ মিলি',
  '১ লিটার',
  '৫ লিটার',
  '১ ডজন',
];

/**
 * Extracts weight/amount description from a product or variant name if present.
 * e.g. "মিনিকেট চাল (৫ কেজি বস্তা (5 kg))" => "৫ কেজি বস্তা"
 * e.g. "লাক্স সাবান (Lux Soap 100g)" => "100g"
 * e.g. "খাঁটি সরিষার তেল (১ জার)" => "১ জার"
 */
export function extractAmountFromName(name: string): string | null {
  if (!name) return null;

  // Check for nested or single parenthesis containing weight/measurement terms
  const matches = name.match(/\(([^)]*(?:কেজি|গ্রাম|মিলি|লিটার|বস্তা|জার|বোতল|প্যাকেট|ডজন|kg|gm|g|ml|ltr|Ltr|dozen)[^)]*)\)/i);
  if (matches && matches[1]) {
    // If it contains an inner parenthesis or extra noise, clean it
    return matches[1].trim();
  }

  // Check for direct regex like "100g", "1kg", "500ml", "500 গ্রাম"
  const directMatch = name.match(/([০-৯0-9.]+\s*(?:কেজি|গ্রাম|মিলি|লিটার|kg|gm|g|ml|ltr|Ltr))/i);
  if (directMatch && directMatch[1]) {
    return directMatch[1].trim();
  }

  return null;
}

/**
 * Formats a clean display string showing quantity and exact amount (কতটুকু).
 * Guarantees that confusing/conflicting labels like "1 গ্রাম" when an item is "53 গ্রাম"
 * or "500 গ্রাম" are NEVER displayed.
 */
export function formatQuantityWithAmount(
  quantity: number | string,
  unit: string,
  packageWeight?: string,
  name?: string
): { mainText: string; subBadge?: string } {
  const cleanWeight = packageWeight?.trim();
  const extracted = name ? extractAmountFromName(name) : null;
  const amountText = cleanWeight || extracted;

  if (amountText) {
    const numQty = Number(quantity);
    const isSingle = isNaN(numQty) || numQty <= 1 || String(quantity).trim() === '1';
    const isWeightUnit = ['গ্রাম', 'কেজি', 'লিটার', 'মিলি'].includes(unit);

    // If unit is already a measurement unit (গ্রাম/কেজি/লিটার/মিলি),
    // OR if quantity is 1 (e.g. 1 item of 53 গ্রাম):
    // Display the exact amountText directly! E.g. "53 গ্রাম" instead of "1 গ্রাম\n53 গ্রাম".
    if (isSingle || isWeightUnit) {
      return { mainText: amountText };
    }

    // If customer bought multiple packages/pieces (e.g. 2 প্যাকেট of 500 গ্রাম)
    return {
      mainText: `${quantity} ${unit}`,
      subBadge: amountText,
    };
  }

  // Fallback: If unit is 'গ্রাম' and quantity is 1, check if name has a gram specification
  if (unit === 'গ্রাম' && (Number(quantity) === 1 || String(quantity).trim() === '1') && name) {
    const numMatch = name.match(/([০-৯0-9.]+\s*(?:গ্রাম|gm|g))/i);
    if (numMatch) {
      return { mainText: numMatch[0] };
    }
  }

  return { mainText: `${quantity} ${unit}` };
}
