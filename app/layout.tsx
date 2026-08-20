import './globals.css'

export const metadata = {
  title: 'Dashboard RMR - B.I. Comercial',
  description: 'Apresentação Reunião Mensal de Resultados',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}