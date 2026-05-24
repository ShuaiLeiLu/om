import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function Markdown({ content, loading }) {
  const processedContent = loading ? `${content} ▍` : content

  return (
    <div className="prose prose-sm max-w-none break-words text-ink-700 prose-headings:text-ink-900 prose-strong:text-ink-900 prose-a:text-celadon-700 prose-code:text-verm-600 prose-pre:bg-ink-900">
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
                className="rounded-xl border border-ink-700/20"
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
              <div className="my-4 overflow-x-auto rounded-xl border border-ink-700/10">
                <table className="min-w-full divide-y divide-rice-300">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="bg-rice-100 px-4 py-2 text-left text-xs font-semibold text-ink-700">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border-t border-rice-300 px-4 py-2 text-sm text-ink-600">
                {children}
              </td>
            )
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
