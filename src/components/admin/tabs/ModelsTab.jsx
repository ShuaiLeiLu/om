'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, ToggleLeft, ToggleRight, Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Badge from '../Badge'
import { cn } from '@/lib/utils'
import { updateAdminModel } from '@/lib/api'

export default function ModelsTab({ data, saving, runAction }) {
  const models = data.models || []
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        models.map((m) => [
          m.id,
          {
            displayName: m.displayName || '',
            sortOrder: String(m.sortOrder ?? 0),
            remark: m.remark || ''
          }
        ])
      )
    )
  }, [models])

  const updateDraft = (id, patch) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  const isDirty = (m) => {
    const d = drafts[m.id]
    if (!d) return false
    return (
      d.displayName !== (m.displayName || '') ||
      String(d.sortOrder ?? '') !== String(m.sortOrder ?? 0) ||
      (d.remark || '') !== (m.remark || '')
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">模型管理</CardTitle>
        <CardDescription>共 {models.length} 个模型 · 修改字段后点保存生效</CardDescription>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <div className="px-1 py-12 text-center text-sm text-muted-foreground">
            暂无模型配置
          </div>
        ) : (
          <div className="space-y-3">
            {models.map((m) => {
              const draft = drafts[m.id] || {}
              const isSaving = saving === `model-save-${m.id}`
              const isToggling = saving === `model-toggle-${m.id}`
              const dirty = isDirty(m)
              return (
                <ModelRow
                  key={m.id}
                  model={m}
                  draft={draft}
                  onChange={(patch) => updateDraft(m.id, patch)}
                  dirty={dirty}
                  isSaving={isSaving}
                  isToggling={isToggling}
                  onToggle={() =>
                    runAction(
                      `model-toggle-${m.id}`,
                      () => updateAdminModel(m.id, { enabled: !m.enabled }),
                      m.enabled ? '模型已停用' : '模型已启用'
                    )
                  }
                  onSave={() =>
                    runAction(
                      `model-save-${m.id}`,
                      () =>
                        updateAdminModel(m.id, {
                          displayName: draft.displayName,
                          sortOrder: Number(draft.sortOrder || 0),
                          remark: draft.remark
                        }),
                      '模型已保存'
                    )
                  }
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ModelRow({ model, draft, onChange, dirty, isSaving, isToggling, onToggle, onSave }) {
  const m = model

  return (
    <div className="rounded-2xl border bg-card/30 transition hover:border-foreground/15 hover:bg-card/50">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br from-primary/20 to-accent/15">
          <Cpu size={16} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground md:text-[15px]">
              {m.displayName || draft.displayName || '未命名模型'}
            </p>
            <Badge tone={m.enabled ? 'emerald' : 'slate'}>
              {m.enabled ? '启用' : '停用'}
            </Badge>
            {dirty && <Badge tone="amber">未保存</Badge>}
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground md:text-[11px]">
            {m.provider} / {m.sub2apiModel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToggle} disabled={isToggling}>
            {isToggling ? (
              <Loader2 className="animate-spin" />
            ) : m.enabled ? (
              <ToggleRight className="text-emerald-300" />
            ) : (
              <ToggleLeft />
            )}
            {m.enabled ? '停用' : '启用'}
          </Button>
          <Button
            variant={dirty ? 'gradient' : 'outline'}
            size="sm"
            onClick={onSave}
            disabled={isSaving || !dirty}
            className={cn(!dirty && 'opacity-50')}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            保存
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 md:px-5 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,100px)_minmax(0,3.5fr)]">
        <FieldRow label="展示名">
          <Input
            value={draft.displayName || ''}
            onChange={(e) => onChange({ displayName: e.target.value })}
            placeholder="给用户看到的名字"
          />
        </FieldRow>
        <FieldRow label="排序">
          <Input
            type="number"
            value={draft.sortOrder || ''}
            onChange={(e) => onChange({ sortOrder: e.target.value })}
            placeholder="0"
            className="text-right font-mono"
          />
        </FieldRow>
        <FieldRow label="备注">
          <Input
            value={draft.remark || ''}
            onChange={(e) => onChange({ remark: e.target.value })}
            placeholder="模型特性、能力描述等"
          />
        </FieldRow>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
