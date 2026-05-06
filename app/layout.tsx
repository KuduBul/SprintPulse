import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shoprite-X Polling App',
  description: 'Live polling and facilitation tool for workshops and sessions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
