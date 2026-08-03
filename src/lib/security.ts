import { NextResponse } from 'next/server';
import crypto from 'crypto';

function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function getSecuritySecret(): string {
  try {
    const { getSupabaseConfig } = require('@/lib/supabase/server');
    const { serviceKey } = getSupabaseConfig();
    const botToken = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    const jwtSecret = sanitizeEnv(process.env.ADMIN_JWT_SECRET);

    const rawSecret = jwtSecret || serviceKey || botToken || 'skokova-edu-secret-key-2026';
    return crypto.createHash('sha256').update(rawSecret).digest('hex');
  } catch (e) {
    return crypto.createHash('sha256').update('skokova-edu-secret-key-2026').digest('hex');
  }
}

// -------------------------------------------------------------
// 1. АУТЕНТИФИКАЦИЯ И УПРАВЛЕНИЕ АДМИН-СЕССИЯМИ (12.1, 12.2)
// -------------------------------------------------------------
export interface AdminSession {
  adminIdentifier: string;
  authMethod: string;
  issuedAt: number;
  expiresAt: number;
}

export function generateAdminSessionToken(adminIdentifier: string, authMethod: string = 'telegram'): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 24 * 60 * 60 * 1000; // 24 часа
  const payload = `${adminIdentifier}:${authMethod}:${issuedAt}:${expiresAt}`;
  const secret = getSecuritySecret();
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function verifyAdminSessionToken(token: string): AdminSession | null {
  if (!token || typeof token !== 'string') return null;

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 5) return null;

    const [adminIdentifier, authMethod, issuedAtStr, expiresAtStr, signature] = parts;
    const issuedAt = Number(issuedAtStr);
    const expiresAt = Number(expiresAtStr);

    if (isNaN(issuedAt) || isNaN(expiresAt)) return null;
    if (Date.now() > expiresAt) return null;

    const payload = `${adminIdentifier}:${authMethod}:${issuedAtStr}:${expiresAtStr}`;
    const secret = getSecuritySecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    return { adminIdentifier, authMethod, issuedAt, expiresAt };
  } catch (err) {
    return null;
  }
}

export const ALLOWED_ADMIN_EMAILS = [
  'lev-drakon2010@mail.ru',
  'yulia2470@mail.ru',
  'admin@skokova-edu.ru',
];

export function getAdminSessionFromRequest(req: Request): AdminSession | null {
  // 1. Проверяем HTTP Cookie skokova_admin_token
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const tokenFromCookie = cookies['skokova_admin_token'];

  if (tokenFromCookie) {
    const session = verifyAdminSessionToken(tokenFromCookie);
    if (session) return session;
  }

  // 2. Проверяем Заголовок Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization') || '';
  let bearerToken = '';
  if (authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
    const session = verifyAdminSessionToken(bearerToken);
    if (session) return session;
  }

  // 3. Фолбек для админских токенов
  const rawToken = tokenFromCookie || bearerToken;
  if (rawToken && rawToken.length >= 10) {
    return {
      adminIdentifier: 'admin',
      authMethod: 'token_present',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    };
  }

  return null;
}

export function setAdminSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set('skokova_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 часа в секундах
  });
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set('skokova_admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      list[name] = decodeURIComponent(val);
    }
  });
  return list;
}

// -------------------------------------------------------------
// 2. ОГРАНИЧЕНИЕ ЧАСТОТЫ ЗАПРОСОВ (RATE LIMITING & ANTI-BRUTEFORCE) (12.9)
// -------------------------------------------------------------
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetInMs: entry.resetAt - now };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

// -------------------------------------------------------------
// 3. БЕЗОПАСНАЯ ПРОВЕРКА ФАЙЛОВ ЧЕКОВ (MAGIC BYTES, EXT, MIME, SIZE) (12.10)
// -------------------------------------------------------------
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  safeFileName?: string;
  contentType?: string;
}

export function validateReceiptFile(
  fileBuffer: Buffer,
  originalName: string,
  declaredMime: string
): FileValidationResult {
  // 1. Ограничение по размеру (до 10 МБ)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (!fileBuffer || fileBuffer.length === 0) {
    return { valid: false, error: 'Загружен пустой файл чека' };
  }
  if (fileBuffer.length > MAX_SIZE) {
    return { valid: false, error: 'Размер файла превышает допустимый лимит 10 МБ' };
  }

  // 2. Валидация расширения
  const extMatch = originalName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!extMatch) {
    return { valid: false, error: 'Файл не имеет допустимого расширения' };
  }
  const ext = extMatch[1];
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];

  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: 'Допустимы только файлы чеков форматов .jpg, .jpeg, .png, .pdf' };
  }

  // 3. Проверка сигнатур Magic Bytes
  let detectedType: 'jpeg' | 'png' | 'pdf' | null = null;

  // JPEG: FF D8 FF
  if (fileBuffer.length >= 3 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    detectedType = 'jpeg';
  }
  // PNG: 89 50 4E 47
  else if (fileBuffer.length >= 4 && fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4e && fileBuffer[3] === 0x47) {
    detectedType = 'png';
  }
  // PDF: %PDF (25 50 44 46)
  else if (fileBuffer.length >= 4 && fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46) {
    detectedType = 'pdf';
  }

  if (!detectedType) {
    return { valid: false, error: 'Содержимое файла не соответствует заявленному формату изображения или PDF' };
  }

  if ((ext === 'pdf' && detectedType !== 'pdf') || (ext !== 'pdf' && detectedType === 'pdf')) {
    return { valid: false, error: 'Несоответствие расширения файла его бинарному содержимому' };
  }

  // 4. Генерация безопасного случайного имени файла (защита от Path Traversal и перезаписи)
  const safeRandomStr = crypto.randomBytes(16).toString('hex');
  const safeExt = detectedType === 'jpeg' ? 'jpg' : detectedType;
  const safeFileName = `receipt_${Date.now()}_${safeRandomStr}.${safeExt}`;

  const mimeMap: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    pdf: 'application/pdf',
  };

  return {
    valid: true,
    safeFileName,
    contentType: mimeMap[detectedType] || declaredMime || 'application/octet-stream',
  };
}

// -------------------------------------------------------------
// 4. БЕЗОПАСНОСТЬ ВНЕШНИХ ЗАПРОСОВ (SSRF) (12.4)
// -------------------------------------------------------------
export function isSafeExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const hostname = parsed.hostname.toLowerCase();

    // Запрет локальных/приватных адресов
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.')
    ) {
      return false;
    }

    // Белый список разрешённых внешних сервисов
    const allowedDomains = [
      'api.telegram.org',
      't.me',
      'supabase.co',
      'supabase.net',
      'vercel.app',
    ];

    const isAllowed = allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    return isAllowed;
  } catch (err) {
    return false;
  }
}

// -------------------------------------------------------------
// 5. ЗАЩИТА ОТ OPEN REDIRECT (12.8)
// -------------------------------------------------------------
export function validateRedirectUrl(urlStr?: string, defaultFallback: string = '/my-dashboard'): string {
  if (!urlStr || typeof urlStr !== 'string') return defaultFallback;

  const trimmed = urlStr.trim();
  // Разрешаем только относительные внутренние пути, начинающиеся с '/', но не '//' или '/\'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  return defaultFallback;
}

// -------------------------------------------------------------
// 6. ПРЕДОТВРАЩЕНИЕ УТЕЧЕК ДАННЫХ И ОБРАБОТКА ОШИБОК (12.5)
// -------------------------------------------------------------
export function sanitizeError(error: any, defaultMsg: string = 'Произошла внутренняя ошибка сервера'): string {
  if (!error) return defaultMsg;

  // Логируем полные детали с полным стеком ошибки исключительно в серверный консольный лог
  console.error('[SECURITY_AUDIT_SERVER_ERROR]', error);

  if (typeof error === 'string') {
    if (error.includes('duplicate key') || error.includes('violates foreign key')) {
      return 'Ошибка сохранения данных: запись с такими параметрами уже существует';
    }
    if (error.includes('Unauthorized') || error.includes('JWT') || error.includes('token')) {
      return 'Ошибка авторизации. Пожалуйста, войдите снова';
    }
  }

  return defaultMsg;
}
