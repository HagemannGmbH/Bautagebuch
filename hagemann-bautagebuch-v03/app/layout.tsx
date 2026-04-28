import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hagemann Bautagebuch v0.3',
  description: 'Mobile Testversion fuer Bauleiter und Buero',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
