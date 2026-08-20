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
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-slate-50 text-slate-800">{children}</body>
    </html>
  )
}