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

function numToWordsUnderThousand(num: number): string {
  let str = '';
  if (num >= 100) {
    str += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    str += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }
  if (num > 0) {
    str += ones[num] + ' ';
  }
  return str.trim();
}

/**
 * Converts a number to Indian Rupee Words format
 * e.g. 11900 -> "Rupees Eleven Thousand Nine Hundred Only"
 * e.g. 1250050.50 -> "Rupees Twelve Lakh Fifty Thousand Fifty and Paise Fifty Only"
 */
export function convertNumberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';

  const parts = amount.toFixed(2).split('.');
  let num = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  let words = '';

  // Crores
  if (num >= 10000000) {
    const crore = Math.floor(num / 10000000);
    words += numToWordsUnderThousand(crore) + ' Crore ';
    num %= 10000000;
  }

  // Lakhs
  if (num >= 100000) {
    const lakh = Math.floor(num / 100000);
    words += numToWordsUnderThousand(lakh) + ' Lakh ';
    num %= 100000;
  }

  // Thousands
  if (num >= 1000) {
    const thousand = Math.floor(num / 1000);
    words += numToWordsUnderThousand(thousand) + ' Thousand ';
    num %= 1000;
  }

  // Hundreds & Below
  if (num > 0) {
    words += numToWordsUnderThousand(num) + ' ';
  }

  words = words.trim();
  let result = `Rupees ${words}`;

  if (paise > 0) {
    result += ` and Paise ${numToWordsUnderThousand(paise)}`;
  }

  return `${result} Only`.replace(/\s+/g, ' ');
}
