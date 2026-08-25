// 真实新闻 API 接入层
// 1) 默认：The Guardian 官方 API —— 完整新闻全文（内置试用 Key，可在设置中换成自己的免费 Key）
// 2) 兜底一：BBC 官方 RSS（经 rss2json 公共 API 转 JSON）—— 摘要较短
// 3) 兜底二：内置示例新闻，断网也能学

export interface NewsItem {
  id: string
  title: string
  text: string // 用于跟读学习的正文（全文或摘要）
  source: string
  category: string
  url: string
  publishedAt: string
  isFallback?: boolean
}

const BBC_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: '国际' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: '财经' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: '科技' },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: '科学' },
]

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url='
const GUARDIAN_TRIAL_KEY = 'test' // Guardian 官方提供的公开试用 Key，有每日限额

// 版面分类：国际形势 / 经济 / 科技 / 科学 / 历史
export interface NewsCategory {
  id: string
  label: string
  en: string
  section?: string // Guardian section
  query?: string // 无对应 section 时用关键词检索
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  { id: 'world', label: '国际形势', en: 'WORLD', section: 'world' },
  { id: 'business', label: '经济', en: 'BUSINESS', section: 'business' },
  { id: 'technology', label: '科技', en: 'TECHNOLOGY', section: 'technology' },
  { id: 'science', label: '科学', en: 'SCIENCE', section: 'science' },
  { id: 'history', label: '历史', en: 'HISTORY', query: 'history' },
]

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

function hashId(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

// 按词数截取到句子边界，避免半截句子
function clipAtWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  const cut = words.slice(0, maxWords).join(' ')
  const lastEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return lastEnd > cut.length * 0.5 ? cut.slice(0, lastEnd + 1) : cut + '.'
}

// —— Guardian 全文 ——
interface GuardianItem {
  id: string
  webTitle: string
  webUrl: string
  webPublicationDate: string
  sectionName?: string
  fields?: { bodyText?: string }
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export async function fetchGuardian(apiKey: string, cat: NewsCategory): Promise<NewsItem[]> {
  const scope = cat.section ? `&section=${encodeURIComponent(cat.section)}` : ''
  const query = cat.query ? `&q=${encodeURIComponent(cat.query)}` : ''
  const endpoint =
    `https://content.guardianapis.com/search?order-by=newest&type=article&page-size=20&show-fields=bodyText${scope}${query}&api-key=` +
    encodeURIComponent(apiKey)
  const res = await fetch(endpoint)
  if (!res.ok) throw new Error('guardian error')
  const data = (await res.json()) as { response?: { results?: GuardianItem[] } }
  const items = data.response?.results ?? []
  const mapped = items
    .map((it) => {
      const body = (it.fields?.bodyText || '').replace(/\s+/g, ' ').trim()
      const wc = wordCount(body)
      // 300~850 词的文章完整使用（真正的“整篇”）；过长的截取前 600 词
      const text = wc <= 850 ? body : clipAtWords(body, 600)
      return {
        id: hashId(it.id + cat.id),
        title: it.webTitle,
        text,
        source: 'The Guardian',
        category: cat.label,
        url: it.webUrl,
        publishedAt: it.webPublicationDate,
      } satisfies NewsItem
    })
    .filter((it) => wordCount(it.text) >= 250)
  // 完整文章（未被截断的）排在前面
  return mapped.sort((a, b) => wordCount(a.text) - wordCount(b.text))
}

// —— BBC 摘要（兜底） ——
interface Rss2JsonItem {
  title: string
  pubDate: string
  link: string
  description?: string
  content?: string
}

async function fetchBbc(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    BBC_FEEDS.map(async (feed) => {
      const res = await fetch(RSS2JSON + encodeURIComponent(feed.url))
      if (!res.ok) throw new Error('feed error')
      const data = (await res.json()) as { status: string; items?: Rss2JsonItem[] }
      if (data.status !== 'ok' || !data.items) return [] as NewsItem[]
      return data.items
        .map((it) => {
          const summary = stripHtml(it.description || it.content || '')
          return {
            id: hashId(it.link),
            title: stripHtml(it.title),
            text: summary,
            source: 'BBC News',
            category: feed.category,
            url: it.link,
            publishedAt: it.pubDate,
          } satisfies NewsItem
        })
        .filter((it) => it.text.length > 60)
        .slice(0, 4)
    }),
  )
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
}

// —— 内置示例（断网兜底） ——
const FALLBACK_ITEMS: NewsItem[] = [
  {
    id: 'fallback-1',
    title: 'Global markets rise as inflation fears ease',
    text: 'Global stock markets have risen sharply after new data showed that inflation is slowing in major economies. Investors welcomed the figures, which suggest that central banks may cut interest rates in the coming months. The rally was led by technology shares, which have been under pressure for weeks. Analysts warn that prices are likely to remain volatile, but many believe the worst of the crisis is over. According to traders, it was the best day for markets this year. It remains to be seen whether the recovery will continue.',
    source: '示例新闻',
    category: '财经',
    url: '',
    publishedAt: new Date().toISOString(),
    isFallback: true,
  },
  {
    id: 'fallback-2',
    title: 'World leaders call for calm amid rising tensions',
    text: 'World leaders have called for calm amid rising tensions in the region. In a bid to ease the crisis, the United Nations is set to hold emergency talks later this week. According to officials, both sides have agreed to take part in the discussions. Hundreds of people have been evacuated from the area, and aid supplies are being delivered by air. A number of countries have urged the two sides to reach a deal. It remains to be seen whether the talks will lead to a lasting settlement.',
    source: '示例新闻',
    category: '国际',
    url: '',
    publishedAt: new Date().toISOString(),
    isFallback: true,
  },
  {
    id: 'fallback-3',
    title: 'New vaccine rollout targets millions in rural areas',
    text: 'Health authorities are rolling out a new vaccine that is expected to protect millions of people in rural areas. The campaign, which began on Monday, is part of a wider effort to curb the outbreak. Officials say hundreds of clinics have been set up, and supplies will be delivered by air where roads have been cut off by floods. The vaccine, which was developed in less than a year, has been shown to be highly effective. If the campaign succeeds, it could become a model for other countries.',
    source: '示例新闻',
    category: '科学',
    url: '',
    publishedAt: new Date().toISOString(),
    isFallback: true,
  },
]

// —— 本地缓存：当天、当前分类只拉取一次 ——
const CACHE_KEY = 'shadow-gazette-cache-v3'

interface CacheShape {
  date: string
  byCat: Record<string, NewsItem[]>
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as CacheShape
    if (cache.date === today() && cache.byCat) return cache
  } catch {
    /* ignore */
  }
  return null
}

function writeCache(catId: string, items: NewsItem[]) {
  const cache = readCache() || { date: today(), byCat: {} }
  cache.byCat[catId] = items
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* 缓存满则放弃写入 */
  }
}

export function loadCachedNews(catId: string): NewsItem[] | null {
  const cache = readCache()
  const items = cache?.byCat[catId]
  return items && items.length > 0 ? items : null
}

export function getGuardianKey(): string {
  return localStorage.getItem('shadow-gazette-guardian-key') || GUARDIAN_TRIAL_KEY
}

export function setGuardianKey(key: string) {
  if (key.trim()) localStorage.setItem('shadow-gazette-guardian-key', key.trim())
  else localStorage.removeItem('shadow-gazette-guardian-key')
}

export function hasCustomGuardianKey(): boolean {
  return Boolean(localStorage.getItem('shadow-gazette-guardian-key'))
}

export interface FetchResult {
  items: NewsItem[]
  fromCache: boolean
  isFallback: boolean
  source: 'guardian' | 'bbc' | 'builtin'
}

export async function fetchDailyNews(catId = 'world', forceRefresh = false): Promise<FetchResult> {
  if (!forceRefresh) {
    const cached = loadCachedNews(catId)
    if (cached) return { items: cached, fromCache: true, isFallback: false, source: 'guardian' }
  }
  const cat = NEWS_CATEGORIES.find((c) => c.id === catId) || NEWS_CATEGORIES[0]
  // 优先 Guardian 完整文章
  try {
    const items = await fetchGuardian(getGuardianKey(), cat)
    if (items.length === 0) throw new Error('empty')
    writeCache(catId, items)
    return { items, fromCache: false, isFallback: false, source: 'guardian' }
  } catch {
    /* 尝试 BBC */
  }
  try {
    const items = await fetchBbc()
    if (items.length === 0) throw new Error('empty')
    return { items, fromCache: false, isFallback: false, source: 'bbc' }
  } catch {
    return { items: FALLBACK_ITEMS, fromCache: false, isFallback: true, source: 'builtin' }
  }
}
