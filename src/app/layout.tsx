import { getThemeFromCookie } from '@/lib/theme';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Arham Always Care — IPD',
  description: 'Animal IPD management',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = getThemeFromCookie(await cookies());
  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${jakarta.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
