import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'VibeCoding Coin Pixel Battle',
  description: 'A fast pixel-battle where the top 100 Solana PumpFun holders fight for dominance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try { fetch('/api/round/ensure').catch(()=>{}) } catch(e){}
          })();
        ` }} />
        {children}
      </body>
    </html>
  )
}

