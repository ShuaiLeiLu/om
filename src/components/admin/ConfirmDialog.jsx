'use client'

// ConfirmDialog → 内部使用 shadcn AlertDialog（Radix UI），保留旧 API。
import { AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  tone = 'danger',
  onConfirm,
  onClose,
  loading
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                tone === 'danger'
                  ? 'border-destructive/30 bg-destructive/15 text-destructive'
                  : 'border-primary/30 bg-primary/15 text-primary'
              )}
            >
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="mt-1.5 whitespace-pre-line">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              // 默认 action 会自动关闭，我们手动控制
              e.preventDefault()
              onConfirm?.()
            }}
            className={cn(
              tone === 'danger' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {loading ? '处理中...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default ConfirmDialog
