import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Sora } from 'next/font/google';
import './globals.css';

/* Fontes do protótipo, hospedadas pelo próprio app (sem chamar o Google a cada visita). */
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', preload: false });

export const metadata: Metadata = {
  title: 'Hub Lead Command',
  description: 'Painel de comando da Hub Performance: Meta Ads, Google Ads e Pipedrive numa tela.',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

/* Entrada animada só no primeiro carregamento, decidida antes da primeira pintura
   (como o script no fim do <body> do protótipo). Sem animação com "reduzir movimento" ligado. */
const ENTRADA = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&navigator.webdriver!==true)document.documentElement.classList.add('enter')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ENTRADA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
