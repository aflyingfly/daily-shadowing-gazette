import type { NewsItem } from '@/lib/news'
import { Badge } from '@/components/ui/badge'

interface Props {
  items: NewsItem[]
  selectedId: string | null
  onSelect: (item: NewsItem) => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - +new Date(iso)
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export default function DigestList({ items, selectedId, onSelect }: Props) {
  return (
    <aside className="w-full lg:w-80 lg:shrink-0">
      <div className="mb-3 flex items-baseline justify-between border-b border-foreground/40 pb-2">
        <h2 className="font-display text-lg font-bold">今日要闻</h2>
        <span className="font-meta text-[10px] uppercase tracking-widest text-muted-foreground">
          Today's Digest
        </span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const active = item.id === selectedId
          return (
            <li key={item.id}>
              <button
                onClick={() => onSelect(item)}
                className={`block w-full rounded-sm px-2 py-3 text-left transition-colors ${
                  active ? 'bg-accent/70' : 'hover:bg-card'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Badge
                    variant={active ? 'default' : 'secondary'}
                    className="h-5 rounded-sm px-1.5 text-[10px] font-normal"
                  >
                    {item.category}
                  </Badge>
                  <span className="font-meta text-[10px] text-muted-foreground">
                    {item.source} · {timeAgo(item.publishedAt)}
                  </span>
                </div>
                <p
                  className={`font-display text-[15px] leading-snug ${
                    active ? 'font-bold text-foreground' : 'font-semibold text-foreground/85'
                  }`}
                >
                  {item.title}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
