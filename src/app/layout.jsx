import './globals.css'

export const metadata = {
  title: '万模AI - 专业多模型助手',
  description: '支持多种顶级 AI 模型的商业级对话助手，适配电脑端与 H5 移动端。',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-slate-950 text-slate-50 antialiased selection:bg-indigo-500/30">
        <div className="relative flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
