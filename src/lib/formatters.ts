/**
 * Автоматическое форматирование имени/текста с заглавной первой буквы
 */
export function capitalizeFirstLetter(val: string): string {
  if (!val) return '';
  return val.charAt(0).toUpperCase() + val.slice(1);
}

/**
 * Автоматическое форматирование российского телефона в формат +7 (XXX) XXX-XX-XX
 */
export function formatRussianPhone(val: string): string {
  let digits = val.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  } else if (!digits.startsWith('7')) {
    digits = '7' + digits;
  }

  digits = digits.slice(0, 11);

  let formatted = '+7';
  if (digits.length > 1) {
    formatted += ' (' + digits.slice(1, 4);
  }
  if (digits.length >= 4) {
    formatted += ') ';
  }
  if (digits.length >= 5) {
    formatted += digits.slice(4, 7);
  }
  if (digits.length >= 8) {
    formatted += '-' + digits.slice(7, 9);
  }
  if (digits.length >= 10) {
    formatted += '-' + digits.slice(9, 11);
  }

  return formatted;
}

/**
 * Автоматическое форматирование Telegram юзернейма с обязательным символом @ в начале
 */
export function formatTelegramHandle(val: string): string {
  if (!val) return '';
  const clean = val.replace(/^@+/, '').trim();
  if (!clean) return '@';
  return '@' + clean;
}
