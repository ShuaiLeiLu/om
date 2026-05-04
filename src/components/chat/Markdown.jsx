import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function Markdown({ content }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-xl border border-slate-700/50"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-xl border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="bg-slate-900 px-4 py-2 text-left text-xs font-semibold text-slate-300">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border-t border-slate-800 px-4 py-2 text-sm text-slate-400">
                {children}
              </td>
            )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
