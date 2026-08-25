// 生词本：自动收藏用户点查过的单词和词组，localStorage 持久化
import { useEffect, useState } from 'react'

export interface WordbookEntry {
  kind: 'word' | 'phrase'
  key: string // 单词原形或词组
  zh: string // 中文释义
  sub?: string // 词性（单词）或用法说明（词组）
  addedAt: number
}

const STORE_KEY = 'shadow-gazette-wordbook-v1'
const CHANGED_EVENT = 'shadow-wordbook-changed'

function readAll(): WordbookEntry[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as WordbookEntry[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeAll(list: WordbookEntry[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT))
}

export function addToWordbook(entry: Omit<WordbookEntry, 'addedAt'>) {
  const list = readAll()
  if (list.some((e) => e.kind === entry.kind && e.key.toLowerCase() === entry.key.toLowerCase())) {
    return // 已收藏，不重复
  }
  list.unshift({ ...entry, addedAt: Date.now() })
  writeAll(list)
}

export function removeFromWordbook(kind: 'word' | 'phrase', key: string) {
  writeAll(readAll().filter((e) => !(e.kind === kind && e.key === key)))
}

export function clearWordbook() {
  writeAll([])
}

// React Hook：订阅生词本变化
export function useWordbook(): WordbookEntry[] {
  const [entries, setEntries] = useState<WordbookEntry[]>(readAll)
  useEffect(() => {
    const onChange = () => setEntries(readAll())
    window.addEventListener(CHANGED_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])
  return entries
}
