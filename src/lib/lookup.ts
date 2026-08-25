// 任意单词在线查询：dictionaryapi.dev（音标/词性/英文释义）+ 谷歌翻译（中文释义）
import { translateText } from './translate'

export interface LookupResult {
  word: string
  phonetic?: string
  pos?: string
  zh?: string
  en?: string
}

interface DictApiEntry {
  word: string
  phonetic?: string
  phonetics?: { text?: string }[]
  meanings?: { partOfSpeech: string; definitions: { definition: string }[] }[]
}

const POS_ZH: Record<string, string> = {
  noun: 'n. 名词',
  verb: 'v. 动词',
  adjective: 'adj. 形容词',
  adverb: 'adv. 副词',
  preposition: 'prep. 介词',
  conjunction: 'conj. 连词',
  pronoun: 'pron. 代词',
  interjection: 'int. 感叹词',
  determiner: 'det. 限定词',
}

export async function lookupWordOnline(rawWord: string): Promise<LookupResult | null> {
  const word = rawWord.toLowerCase().replace(/[^a-z'-]/g, '')
  if (!word || word.length < 2) return null
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    const zh = await translateText(word)
    if (!res.ok) {
      return zh ? { word, zh } : null
    }
    const data = (await res.json()) as DictApiEntry[]
    const entry = data[0]
    if (!entry) return zh ? { word, zh } : null
    const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text
    const meaning = entry.meanings?.[0]
    // 合并所有词性，避免多义词只显示一个误导性的词性
    const posList = entry.meanings
      ? [...new Set(entry.meanings.map((m) => m.partOfSpeech))].map((p) => POS_ZH[p] || p).join(' · ')
      : undefined
    return {
      word,
      phonetic,
      pos: posList,
      zh,
      en: meaning?.definitions?.[0]?.definition,
    }
  } catch {
    return null
  }
}
