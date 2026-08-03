import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const displaySerif = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FAF8F5',
};

export const metadata: Metadata = {
  title: 'Скокова Юлия Павловна | Эксперт по развитию и подготовке к школе',
  description: 'Подготовка к 1 классу и репетиторство для учеников 1–4 классов. Интерактивные онлайн-уроки с использованием нейропедагогического подхода для уверенного старта в школе.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/avatar.png', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/avatar.png',
    apple: '/avatar.png',
  },
  openGraph: {
    title: 'Скокова Юлия Павловна | Эксперт по развитию и подготовке к школе',
    description: 'Индивидуальные онлайн-уроки и подготовка к школе без слёз и стресса.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Скокова Юлия Павловна',
    jobTitle: 'Педагог-эксперт по подготовке к школе и учитель начальных классов',
    description: 'Опыт работы более 30 лет. Подготовка к 1 классу и репетиторство 1–4 классов.',
    url: 'https://skokova-edu.vercel.app',
    sameAs: ['https://t.me/skokovaedu_bot'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Программы обучения',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Course',
            name: 'Подготовка к школе (5–7 лет)',
            description: 'Чтение, письмо, математика, нейрогимнастика и развитие внимания.',
          },
          price: '600',
          priceCurrency: 'RUB',
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Course',
            name: 'Репетитор начальных классов (1–4 классы)',
            description: 'Помощь по программе, устранение пробелов, подготовка к ВПР.',
          },
          price: '600',
          priceCurrency: 'RUB',
        },
      ],
    },
  };

  return (
    <html lang="ru" className={`${displaySerif.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased bg-[#FAF8F5] text-[#1F1E1D] selection:bg-[#C85A32] selection:text-white relative">
        <div className="fixed inset-0 pointer-events-none z-30 bg-noise opacity-40" />
        {children}
      </body>
    </html>
  );
}

