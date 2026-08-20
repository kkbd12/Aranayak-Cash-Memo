import { Product } from '../types';

/**
 * Automatically generates a unique, sequential SKU (e.g. SKU-1001, SKU-1002...)
 * based on existing products in the catalog.
 */
export function generateAutoSKU(products: Product[] = [], category?: string): string {
  let maxNumber = 1000;

  // Scan existing product codes to find the highest number
  products.forEach((p) => {
    if (p.code) {
      // Look for numbers anywhere or at the end of the code (e.g., SKU-1001, PROD-1025, 1005)
      const matches = p.code.match(/\d+/g);
      if (matches) {
        matches.forEach((m) => {
          const num = parseInt(m, 10);
          if (!isNaN(num) && num >= 100 && num < 999999) {
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });
      }
    }
  });

  const nextNumber = maxNumber + 1;

  // If category is provided and user wants category initials, we can support it,
  // but standard SKU-XXXX is the most reliable and readable for barcode scanners
  return `SKU-${nextNumber}`;
}
