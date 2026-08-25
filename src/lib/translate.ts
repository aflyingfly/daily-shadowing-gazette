// 翻译模块：谷歌免费翻译接口（支持浏览器跨域），结果本地缓存

const CACHE_PREFIX = 'shadow-gazette-tr:'

function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

type GtxResponse = [[string, string, ...unknown[]][] | null, ...unknown[]]

async function translateOnce(q: string): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=' +
    encodeURIComponent(q)
  const res = await fetch(url)
  if (!res.ok) throw new Error('translate error')
  const data = (await res.json()) as GtxResponse
  const segments = data[0] || []
  return segments.map((seg) => seg[0]).join('')
}

export async function translateText(text: string): Promise<string> {
  const key = CACHE_PREFIX + hash(text)
  try {
    const cached = localStorage.getItem(key)
    if (cached) return cached
  } catch {
    /* ignore */
  }
  try {
    const zh = await translateOnce(text)
    try {
      localStorage.setItem(key, zh)
    } catch {
      /* 缓存满了就清理一批 */
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX))
      keys.slice(0, 50).forEach((k) => localStorage.removeItem(k))
    }
    return zh
  } catch {
    return ''
  }
}

// 批量翻译（有限并发，避免触发限流）
export async function translateBatch(
  texts: string[],
  onProgress?: (index: number, zh: string) => void,
): Promise<string[]> {
  const results: string[] = new Array(texts.length).fill('')
  const queue = texts.map((t, i) => ({ t, i }))
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break
      const zh = await translateText(job.t)
      results[job.i] = zh
      onProgress?.(job.i, zh)
    }
  })
  await Promise.all(workers)
  return results
}
