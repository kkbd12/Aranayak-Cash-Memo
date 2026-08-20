/**
 * Converts numeric amounts into Bengali words for Cash Memos
 */

const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(num: number | string): string {
  return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function formatCurrency(amount: number, symbol: string = '৳'): string {
  const formatted = amount.toLocaleString('bn-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

export function numberToBnWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'শূণ্য টাকা মাত্র';

  const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়'];
  const teens = ['দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পোনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ'];
  const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    const tenDigit = Math.floor(n / 10);
    const unitDigit = n % 10;
    return `${tens[tenDigit]} ${units[unitDigit]}`.trim();
  }

  let integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  if (integerPart === 0) {
    if (decimalPart > 0) {
      return `${convertTwoDigits(decimalPart)} পয়সা মাত্র`;
    }
    return 'শূণ্য টাকা মাত্র';
  }

  let words = '';

  // Crores (কোটি)
  if (integerPart >= 10000000) {
    const crore = Math.floor(integerPart / 10000000);
    words += `${convertTwoDigits(crore)} কোটি `;
    integerPart %= 10000000;
  }

  // Lakhs (লক্ষ)
  if (integerPart >= 100000) {
    const lakh = Math.floor(integerPart / 100000);
    words += `${convertTwoDigits(lakh)} লক্ষ `;
    integerPart %= 100000;
  }

  // Thousands (হাজার)
  if (integerPart >= 1000) {
    const thousand = Math.floor(integerPart / 1000);
    words += `${convertTwoDigits(thousand)} হাজার `;
    integerPart %= 1000;
  }

  // Hundreds (শত)
  if (integerPart >= 100) {
    const hundred = Math.floor(integerPart / 100);
    words += `${units[hundred]} শত `;
    integerPart %= 100;
  }

  // Remaining 1-99
  if (integerPart > 0) {
    words += `${convertTwoDigits(integerPart)} `;
  }

  words = words.trim() + ' টাকা';

  if (decimalPart > 0) {
    words += ` এবং ${convertTwoDigits(decimalPart)} পয়সা`;
  }

  return words + ' মাত্র';
}
