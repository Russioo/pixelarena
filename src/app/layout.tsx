import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Pixel Arena',
  description: 'Pixel Arena – et hurtigt pixel-battle hvor top PumpFun holders kæmper om brættet',
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

