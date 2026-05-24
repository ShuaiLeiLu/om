'use client'

import { Loader2, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

// 通用数据表格。
//
// Props:
//  - columns: [{ key, label, width?, align?, render?(row) }]
//  - rows:    Array of any
//  - rowKey:  (row, idx) => string
//  - loading, empty(可选 自定义节点)
//  - dense:   更紧凑的行高（适合大数据量表）
export function DataTable({
  columns,
  rows = [],
  rowKey = (_, i) => i,
  loading = false,
  empty,
  dense = false
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700/10 bg-rice-50 shadow-[var(--shadow-paper)]">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-700/10 bg-rice-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 text-[10px] text-ink-500 label-zh md:px-4',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center'
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-ink-500"
                >
                  <Loader2 className="mx-auto animate-spin text-celadon-600" size={20} />
                  <p className="mt-2 text-xs">正在加载...</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  {empty || <DefaultEmpty />}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={rowKey(row, idx)}
                  className={cn(
                    'border-b border-rice-200 transition-colors hover:bg-rice-100 last:border-b-0',
                    dense ? '' : ''
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'text-xs text-ink-700 md:text-[13px]',
                        dense ? 'px-3 py-2 md:px-4' : 'px-3 py-3 md:px-4 md:py-3.5',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center'
                      )}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DefaultEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 text-ink-500">
      <Inbox size={20} strokeWidth={1.5} />
      <p className="text-xs">暂无数据</p>
    </div>
  )
}

export default DataTable
