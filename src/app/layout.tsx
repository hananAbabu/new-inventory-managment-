import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Copperleaf Merch Co. — Inventory Management System',
  description:
    'Role-based inventory, point of sale, purchasing and reporting for a small merch shop.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${sora.variable}`}>
      <body>
        <Providers>{children}</Providers>
        {/* Receipts portal in here so window.print() sees only the receipt. */}
        <div id="print-area" />
      </body>
    </html>
  );
}
