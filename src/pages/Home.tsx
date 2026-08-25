import { useCallback, useEffect, useState } from 'react'
import { fetchDailyNews, NEWS_CATEGORIES, type NewsItem } from '@/lib/news'
import Masthead from '@/sections/Masthead'
import SectionNav from '@/sections/SectionNav'
import DigestList from '@/sections/DigestList'
import LessonView from '@/sections/LessonView'
import SettingsSheet from '@/sections/SettingsSheet'
import WordbookSheet from '@/sections/WordbookSheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw } from 'lucide-react'
import '../App.css'

const CAT_KEY = 'shadow-gazette-category'

export default function Home() {
  const [category, setCategory] = useState(() => localStorage.getItem(CAT_KEY) || 'world')
  const [items, setItems] = useState<NewsItem[]>([])
  const [selected, setSelected] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFallback, setIsFallback] = useState(false)

  const load = useCallback(async (cat: string, force = false) => {
    setLoading(true)
    const result = await fetchDailyNews(cat, force)
    setItems(result.items)
    setIsFallback(result.isFallback)
    setSelected(result.items[0] ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(category)
  }, [category, load])

  const changeCategory = (id: string) => {
    if (id === category) return
    setCategory(id)
    localStorage.setItem(CAT_KEY, id)
  }

  const catLabel = NEWS_CATEGORIES.find((c) => c.id === category)?.label || ''

  return (
    <div className="min-h-screen pb-16">
      <Masthead />
      <SectionNav active={category} onChange={changeCategory} />

      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between px-4 sm:px-6">
        <p className="text-sm text-muted-foreground">
          {isFallback
            ? '⚠️ 当前网络无法连接新闻源，正在使用内置示例新闻练习'
            : loading
              ? `正在加载「${catLabel}」版面的完整文章…`
              : `「${catLabel}」版面今天有 ${items.length} 篇完整文章，点击左侧标题开始学习`}
        </p>
        <div className="flex items-center gap-1">
          <WordbookSheet />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => load(category, true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 刷新新闻
          </Button>
          <SettingsSheet onSaved={() => load(category, true)} />
        </div>
      </div>

      <main className="mx-auto mt-6 flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:flex-row">
        {loading ? (
          <div className="flex w-full flex-col gap-10 lg:flex-row">
            <div className="w-full space-y-3 lg:w-80 lg:shrink-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-muted" />
              ))}
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="h-9 w-3/4 bg-muted" />
              <Skeleton className="h-24 w-full bg-muted" />
              <Skeleton className="h-24 w-full bg-muted" />
            </div>
          </div>
        ) : (
          <>
            <DigestList items={items} selectedId={selected?.id ?? null} onSelect={setSelected} />
            {selected && <LessonView item={selected} />}
          </>
        )}
      </main>

      <footer className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="rule-double pt-4 text-center">
          <p className="font-meta text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            学习方法：听一遍 → 看讲解 → 逐句跟读 → 脱稿复述
          </p>
        </div>
      </footer>
    </div>
  )
}
