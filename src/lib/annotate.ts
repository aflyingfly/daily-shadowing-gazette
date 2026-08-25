import { WORD_BANK, SPECIAL_USAGES, type WordEntry, type UsageEntry } from './dictionary'
import { detectGrammar, type GrammarHit } from './grammar'

export interface Segment {
  text: string
  type: 'plain' | 'vocab' | 'usage'
  entry?: WordEntry | UsageEntry
}

export interface AnnotatedSentence {
  raw: string
  segments: Segment[]
  grammar: GrammarHit[]
}

// —— 词典索引 ——
const wordMap = new Map<string, WordEntry>()
for (const w of WORD_BANK) wordMap.set(w.word.toLowerCase(), w)

// 按词数从多到少排序，保证最长匹配优先
const usageList = [...SPECIAL_USAGES].sort(
  (a, b) => b.phrase.split(' ').length - a.phrase.split(' ').length,
)

function normalize(token: string): string {
  return token.toLowerCase().replace(/[^a-z'-]/g, '')
}

// 尝试把变形词还原为词典原形：prices -> price, announced -> announce, rising -> rise
function lookupWord(token: string): WordEntry | undefined {
  const t = normalize(token)
  if (!t || t.length < 3) return undefined
  const direct = wordMap.get(t)
  if (direct) return direct
  const candidates: string[] = []
  if (t.endsWith("'s")) candidates.push(t.slice(0, -2))
  if (t.endsWith('es')) candidates.push(t.slice(0, -2), t.slice(0, -1))
  if (t.endsWith('s')) candidates.push(t.slice(0, -1))
  if (t.endsWith('ied')) candidates.push(t.slice(0, -3) + 'y')
  if (t.endsWith('ed')) candidates.push(t.slice(0, -2), t.slice(0, -1))
  if (t.endsWith('ing')) candidates.push(t.slice(0, -3), t.slice(0, -3) + 'e')
  for (const c of candidates) {
    const hit = wordMap.get(c)
    if (hit) return hit
  }
  return undefined
}

// 尝试匹配多词短语（容忍大小写）
function matchUsage(
  words: { text: string }[],
  start: number,
): { entry: UsageEntry; length: number } | undefined {
  for (const usage of usageList) {
    const parts = usage.phrase.toLowerCase().split(' ')
    if (start + parts.length > words.length) continue
    let ok = true
    for (let i = 0; i < parts.length; i++) {
      if (normalize(words[start + i].text) !== parts[i]) {
        ok = false
        break
      }
    }
    if (ok) return { entry: usage, length: parts.length }
  }
  return undefined
}

// —— 句子切分 ——
export function splitSentences(text: string): string[] {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\b(Mr|Mrs|Ms|Dr|St|No|vs|etc)\./g, '$1<DOT>')
    .replace(/\b([A-Z])\.(?=\s+[A-Z])/g, '$1<DOT>')
    .trim()
  const parts = cleaned.match(/[^.!?]+[.!?]+["'”’)\]]*\s*/g) || [cleaned]
  return parts
    .map((s) => s.replace(/<DOT>/g, '.').trim())
    .filter((s) => s.split(' ').length >= 3 && /[a-zA-Z]/.test(s))
}

// —— 句子标注 ——
export function annotateSentence(sentence: string): AnnotatedSentence {
  const wordRe = /[A-Za-z][A-Za-z'-]*/g
  const words: { text: string; start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = wordRe.exec(sentence)) !== null) {
    words.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  }

  const segments: Segment[] = []
  let cursor = 0
  let w = 0
  while (w < words.length) {
    const usageHit = matchUsage(words, w)
    if (usageHit) {
      const first = words[w]
      const last = words[w + usageHit.length - 1]
      if (first.start > cursor) segments.push({ text: sentence.slice(cursor, first.start), type: 'plain' })
      segments.push({
        text: sentence.slice(first.start, last.end),
        type: 'usage',
        entry: usageHit.entry,
      })
      cursor = last.end
      w += usageHit.length
      continue
    }
    const entry = lookupWord(words[w].text)
    if (entry) {
      if (words[w].start > cursor) segments.push({ text: sentence.slice(cursor, words[w].start), type: 'plain' })
      segments.push({ text: sentence.slice(words[w].start, words[w].end), type: 'vocab', entry })
      cursor = words[w].end
    }
    w++
  }
  if (cursor < sentence.length) segments.push({ text: sentence.slice(cursor), type: 'plain' })

  return { raw: sentence, segments, grammar: detectGrammar(sentence) }
}

export interface LessonVocab {
  entry: WordEntry
  sentence: string
}

export interface LessonUsage {
  entry: UsageEntry
  sentence: string
}

export interface AnnotatedArticle {
  sentences: AnnotatedSentence[]
  vocab: LessonVocab[]
  usages: LessonUsage[]
}

export function annotateArticle(text: string): AnnotatedArticle {
  const sentences = splitSentences(text).map(annotateSentence)
  const vocabSeen = new Set<string>()
  const usageSeen = new Set<string>()
  const vocab: LessonVocab[] = []
  const usages: LessonUsage[] = []
  for (const s of sentences) {
    for (const seg of s.segments) {
      if (seg.type === 'vocab' && seg.entry) {
        const e = seg.entry as WordEntry
        if (!vocabSeen.has(e.word)) {
          vocabSeen.add(e.word)
          vocab.push({ entry: e, sentence: s.raw })
        }
      }
      if (seg.type === 'usage' && seg.entry) {
        const e = seg.entry as UsageEntry
        if (!usageSeen.has(e.phrase)) {
          usageSeen.add(e.phrase)
          usages.push({ entry: e, sentence: s.raw })
        }
      }
    }
  }
  return { sentences, vocab, usages }
}
