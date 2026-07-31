import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Скокова Юлия Павловна | Telegram Mini App',
  description: 'Интерактивное Telegram Mini App для записи на уроки и подготовки к школе',
};

export default function TwaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      {children}
    </>
  );
}
