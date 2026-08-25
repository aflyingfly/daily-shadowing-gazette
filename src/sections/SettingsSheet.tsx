import { useState } from 'react'
import { getGuardianKey, setGuardianKey, hasCustomGuardianKey } from '@/lib/news'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings } from 'lucide-react'

interface Props {
  onSaved: () => void
}

export default function SettingsSheet({ onSaved }: Props) {
  const [key, setKey] = useState(hasCustomGuardianKey() ? getGuardianKey() : '')
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Settings className="h-4 w-4" /> 新闻源设置
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-card">
        <SheetHeader>
          <SheetTitle className="font-display">新闻源设置</SheetTitle>
          <SheetDescription>
            默认使用 The Guardian 官方新闻全文（内置公开试用
            Key，有每日限额）。如果新闻加载失败或想长期使用，可申请自己的免费 Key 填入下方。
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Guardian API Key（可选）</label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="留空则使用内置试用 Key"
              className="bg-background"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              免费申请：打开 open-platform.theguardian.com → 注册 → 立即获得
              Key。填入后新闻将使用你自己的额度，更稳定。
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setGuardianKey(key)
              setOpen(false)
              onSaved()
            }}
          >
            保存并刷新新闻
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
