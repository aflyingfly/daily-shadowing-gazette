import { useState } from 'react'
import { useWordbook, removeFromWordbook, clearWordbook } from '@/lib/wordbook'
import { speak, getVoiceId } from '@/lib/speech'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NotebookPen, Volume2, Trash2 } from 'lucide-react'

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function WordbookSheet() {
  const entries = useWordbook()
  const [open, setOpen] = useState(false)
  const words = entries.filter((e) => e.kind === 'word')
  const phrases = entries.filter((e) => e.kind === 'phrase')

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <NotebookPen className="h-4 w-4" /> 生词本（{entries.length}）
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] bg-card sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="font-display">我的生词本</SheetTitle>
          <SheetDescription>
            你在阅读中点查过的单词和词组会自动收藏到这里，方便每天复习。
          </SheetDescription>
        </SheetHeader>

        {entries.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            还没有收藏。
            <br />
            阅读时点一下文章里的单词或橙色词组，就会自动加入生词本。
          </p>
        ) : (
          <>
            <Tabs defaultValue="word" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="word" className="flex-1">
                  单词（{words.length}）
                </TabsTrigger>
                <TabsTrigger value="phrase" className="flex-1">
                  词组（{phrases.length}）
                </TabsTrigger>
              </TabsList>
              {(
                [
                  ['word', words],
                  ['phrase', phrases],
                ] as const
              ).map(([tab, list]) => (
                <TabsContent key={tab} value={tab}>
                  <ul className="mt-2 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: '65vh' }}>
                    {list.map((e) => (
                      <li
                        key={e.key}
                        className="group flex items-start gap-2 rounded-sm px-2 py-2 hover:bg-background"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-display text-[15px] font-bold">{e.key}</span>
                            {e.sub && tab === 'word' && (
                              <span className="text-xs text-muted-foreground">{e.sub}</span>
                            )}
                            <span className="font-meta ml-auto shrink-0 text-[10px] text-muted-foreground">
                              {formatDate(e.addedAt)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{e.zh}</p>
                          {e.sub && tab === 'phrase' && (
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/80">{e.sub}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            className="rounded p-1 text-primary hover:bg-accent"
                            title="朗读"
                            onClick={() => speak(e.key, 0.9, getVoiceId())}
                          >
                            <Volume2 className="h-4 w-4" />
                          </button>
                          <button
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="移出生词本"
                            onClick={() => removeFromWordbook(e.kind, e.key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              ))}
            </Tabs>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-xs text-muted-foreground"
              onClick={() => {
                if (window.confirm('确定要清空生词本吗？此操作不可恢复。')) clearWordbook()
              }}
            >
              清空生词本
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
