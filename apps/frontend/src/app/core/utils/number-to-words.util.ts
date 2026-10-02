/**
 * Utility to convert numeric amounts to Indian Currency Words.
 * Formats into Lakhs and Crores standard (e.g. Rupees Four Lakh Seventy-Four Thousand Only)
 */
export function convertNumberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'Rupees Zero Only';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function twoDigits(num: number): string {
    if (num < 20) return ones[num];
    const t = Math.floor(num / 10);
    const o = num % 10;
    return tens[t] + (o > 0 ? ' ' + ones[o] : '');
  }

  function threeDigits(num: number): string {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    let res = '';
    if (h > 0) {
      res += ones[h] + ' Hundred';
      if (rest > 0) res += ' ';
    }
    if (rest > 0) {
      res += twoDigits(rest);
    }
    return res.trim();
  }

  // Indian numbering: Crores (10^7), Lakhs (10^5), Thousands (10^3), Hundreds (1-999)
  let num = integerPart;
  const parts: string[] = [];

  const crores = Math.floor(num / 10000000);
  num %= 10000000;

  const lakhs = Math.floor(num / 100000);
  num %= 100000;

  const thousands = Math.floor(num / 1000);
  num %= 1000;

  const hundreds = num;

  if (crores > 0) {
    parts.push(twoDigits(crores) + ' Crore');
  }
  if (lakhs > 0) {
    parts.push(twoDigits(lakhs) + ' Lakh');
  }
  if (thousands > 0) {
    parts.push(twoDigits(thousands) + ' Thousand');
  }
  if (hundreds > 0) {
    parts.push(threeDigits(hundreds));
  }

  let words = parts.join(' ').trim();
  if (!words) {
    words = 'Zero';
  }

  let result = (isNegative ? 'Minus ' : '') + 'Rupees ' + words;

  if (decimalPart > 0) {
    result += ' and ' + twoDigits(decimalPart) + ' Paise';
  }

  return result + ' Only';
}
