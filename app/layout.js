import './theme.css'

export const metadata = {
  title: 'まなびのわ',
  description: '社内の勉強会から知見を集め、次の場をAIが立てる',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  )
}
