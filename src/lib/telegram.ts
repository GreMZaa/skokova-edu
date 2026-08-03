const DEFAULT_BOT_TOKEN = '8656501308:AAFDzAuFznqhjRgWd35p-NvUa_hg1pwhoqM';
const DEFAULT_TEACHER_CHAT_ID = '-5128191766';

export function getTelegramConfig() {
  const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').replace(/["'\r\n]/g, '').trim();
  const envChatId = (process.env.TELEGRAM_TEACHER_CHAT_ID || '').replace(/["'\r\n]/g, '').trim();

  const botToken = envToken && envToken.length >= 20 && !envToken.includes('123456789')
    ? envToken
    : DEFAULT_BOT_TOKEN;

  const teacherChatId = envChatId || DEFAULT_TEACHER_CHAT_ID;

  return { botToken, teacherChatId };
}

export function escapeMarkdown(text: string): string {
  if (!text) return '';
  // Экранируем спецсимволы Markdown V1, чтобы имена вроде @vasilina_original не ломали верстку
  return text.replace(/([_*`\[\]()])/g, '\\$1');
}

export async function sendTelegramNotification(options: {
  chatId?: string;
  text: string;
  keyboard?: any;
  parseMode?: 'Markdown' | 'HTML';
}): Promise<boolean> {
  const { botToken, teacherChatId } = getTelegramConfig();
  const targetChatId = options.chatId || teacherChatId;

  if (!botToken || !targetChatId) {
    console.warn('Telegram config is missing botToken or teacherChatId');
    return false;
  }

  const payload: Record<string, any> = {
    chat_id: targetChatId,
    text: options.text,
  };

  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  if (options.keyboard) {
    payload.reply_markup = options.keyboard;
  }

  try {
    let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let json = await res.json();

    // Если Telegram вернул ошибку (например, 400 Bad Request: can't parse entities из-за @vasilina_original),
    // совершаем повторную попытку без parse_mode для гарантированной доставки!
    if (!json.ok && payload.parse_mode) {
      console.warn('Telegram sendMessage failed with parse_mode, retrying without parse_mode:', json.description);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.parse_mode;

      res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackPayload),
      });

      json = await res.json();
    }

    if (!json.ok) {
      console.error('Telegram sendMessage error final:', json);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram notification network error:', error);
    return false;
  }
}
