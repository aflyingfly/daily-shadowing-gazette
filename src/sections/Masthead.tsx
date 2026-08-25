// 报头：报纸刊头 + 日期 + 期号
export default function Masthead() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
  // 期号：当年第几天
  const start = new Date(now.getFullYear(), 0, 0)
  const issueNo = Math.floor((+now - +start) / 86400000)

  return (
    <header className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <div className="rule-double pb-1 pt-1">
        <div className="flex items-center justify-between font-meta text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>每日一句 · 听说并进</span>
          <span className="hidden sm:inline">The Daily Shadowing Gazette</span>
          <span>第 {issueNo} 期</span>
        </div>
      </div>
      <div className="flex flex-col items-center py-6 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          每日英语新闻跟读
        </h1>
        <p className="font-meta mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Read · Listen · Repeat — 每天一篇真实新闻
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{dateStr}</p>
      </div>
      <div className="rule-double" />
    </header>
  )
}
