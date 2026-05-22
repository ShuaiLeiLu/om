'use client'

import {
  Lightbulb,
  Code2,
  PenLine,
  BarChart3,
  Languages,
  Sparkles,
  ArrowUpRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STARTERS = [
  {
    icon: Lightbulb,
    title: '帮我想 3 个点子',
    description: '为我的咖啡品牌想 3 个冬季营销活动主题',
    prompt: '为我的咖啡品牌想 3 个冬季营销活动主题，每个都附一句 slogan',
    accent: 'from-amber-500/30 to-orange-500/20 border-amber-400/25 text-amber-200'
  },
  {
    icon: Code2,
    title: '解释一段代码',
    description: '逐行解释 React useMemo 的工作原理',
    prompt:
      '请逐行讲解下面这段 React 代码，说明 useMemo 的作用和适用场景：\n\n```jsx\nconst expensiveValue = useMemo(() => compute(a, b), [a, b])\n```',
    accent: 'from-cyan-500/30 to-blue-500/20 border-cyan-400/25 text-cyan-200'
  },
  {
    icon: PenLine,
    title: '帮我写一段文案',
    description: '产品冷启动期的微信公众号开头 200 字',
    prompt:
      '我有一个 AI 多模型聚合产品要冷启动，帮我写一段微信公众号文章的开头，200 字以内，带一点期待感和好奇心',
    accent: 'from-fuchsia-500/30 to-pink-500/20 border-fuchsia-400/25 text-fuchsia-200'
  },
  {
    icon: BarChart3,
    title: '数据分析建议',
    description: '电商订单数据有哪些常见维度可以挖掘',
    prompt:
      '我有一份电商订单数据（订单时间、金额、SKU、用户、城市），帮我列出 6 个可以分析的角度，每个给一句话价值描述',
    accent: 'from-emerald-500/30 to-teal-500/20 border-emerald-400/25 text-emerald-200'
  },
  {
    icon: Languages,
    title: '翻译并优化',
    description: '把中文 PR 描述翻译成地道英文',
    prompt:
      '把下面这段 PR 描述翻译成地道的工程师英文，简洁直接：\n\n"修复了图片生成在 n>1 时偶发返回空数组的问题，根因是上游响应解析时的边界条件。"',
    accent: 'from-violet-500/30 to-indigo-500/20 border-violet-400/25 text-violet-200'
  },
  {
    icon: Sparkles,
    title: '随便聊聊',
    description: '今天你想到什么有意思的话题',
    prompt: '随便和我聊聊吧——最近你"见到"的最有意思的一个用户问题是什么？',
    accent: 'from-rose-500/30 to-pink-500/20 border-rose-400/25 text-rose-200'
  }
]

export function StarterPrompts({
  onPick,
  modelName,
  providerColor,
  providerLogo,
  providerInitial
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-col items-center gap-3 text-center md:mb-8 md:gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 md:h-14 md:w-14"
          style={{
            backgroundColor: `${providerColor}25`,
            boxShadow: `0 10px 40px ${providerColor}30`
          }}
        >
          {providerLogo ? (
            <img src={providerLogo} alt="" className="h-7 w-7 object-contain md:h-9 md:w-9" />
          ) : (
            <span className="text-2xl font-bold" style={{ color: providerColor }}>
              {providerInitial}
            </span>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white md:text-xl">
            和 <span className="text-gradient-brand">{modelName}</span> 聊点什么？
          </h3>
          <p className="mt-1.5 text-[11px] text-slate-400 md:text-xs">
            点击下面的卡片快速开始
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        {STARTERS.map((s) => (
          <button
            key={s.title}
            onClick={() => onPick(s.prompt)}
            className={cn(
              'group relative flex items-start gap-2.5 overflow-hidden rounded-2xl border bg-slate-900/35 p-3 text-left transition-all duration-300 tap-transparent active:scale-[0.98]',
              'border-white/5 hover:border-indigo-500/20 hover:bg-slate-950/60 hover:shadow-[0_8px_20px_rgba(99,102,241,0.08)]',
              'sm:p-4 sm:gap-3'
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br sm:h-9 sm:w-9',
                s.accent
              )}
            >
              <s.icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-100 sm:text-sm">
                {s.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[10.5px] text-slate-400 leading-relaxed sm:text-xs">
                {s.description}
              </p>
            </div>
            <ArrowUpRight
              size={12}
              className="hidden shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-300 sm:block"
            />
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-[10px] text-slate-600">
        所有对话保存在本地，可以在左侧栏找到历史记录
      </p>
    </div>
  )
}

export default StarterPrompts
