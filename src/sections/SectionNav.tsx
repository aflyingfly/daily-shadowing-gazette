import { NEWS_CATEGORIES } from '@/lib/news'

interface Props {
  active: string
  onChange: (id: string) => void
}

// 报纸版面导航：选一个方向，推送该方向的完整文章
export default function SectionNav({ active, onChange }: Props) {
  return (
    <nav className="mx-auto mt-5 max-w-6xl px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 border-y border-foreground/40 py-2.5">
        {NEWS_CATEGORIES.map((cat, i) => (
          <span key={cat.id} className="flex items-center">
            {i > 0 && <span className="mx-3 text-muted-foreground/50">·</span>}
            <button
              onClick={() => onChange(cat.id)}
              className={`group flex items-baseline gap-1.5 px-1 pb-0.5 transition-colors ${
                active === cat.id
                  ? 'border-b-2 border-primary font-bold text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="font-display text-lg tracking-wide">{cat.label}</span>
              <span className="font-meta text-[9px] uppercase tracking-[0.15em] opacity-60 group-hover:opacity-100">
                {cat.en}
              </span>
            </button>
          </span>
        ))}
      </div>
    </nav>
  )
}
