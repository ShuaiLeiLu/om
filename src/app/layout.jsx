import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export const metadata = {
  title: '万模AI - 专业多模型助手',
  description: '支持多种顶级 AI 模型的商业级对话助手，适配电脑端与 H5 移动端。',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', type: 'image/png' }
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  }
}

// 全站固定 dark 主题（shadcn 的 dark 变体生效需要 html.dark 存在）。
// 主题切换器（如果以后要加）可以改这里 + 在 Toggle 里 .toggle('dark')。
export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground">
        <TooltipProvider delayDuration={300}>
          <div className="relative flex min-h-screen flex-col">{children}</div>
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  )
}
