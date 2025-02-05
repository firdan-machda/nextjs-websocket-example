import Head from 'next/head'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Experimental Application',
  description: 'An experimental application using Next.js',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full bg-sky-200">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <body className={`min-h-screen flex flex-col ${inter.className}`}>
        {children}
      </body>
    </html>
  )
}
