import { useEffect, useMemo, useRef, useState } from 'react'
import type { NewsItem } from '@/lib/news'
import { annotateArticle } from '@/lib/annotate'
import { speak, stopSpeak, getVoiceId, setVoiceIdStored, EDGE_VOICES } from '@/lib/speech'
import { translateBatch } from '@/lib/translate'
import SentenceRow from '@/sections/SentenceRow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Square, ExternalLink, BookOpen, Sparkles, Languages, Landmark } from 'lucide-react'

interface Props {
  item: NewsItem
}

export default function LessonView({ item }: Props) {
  const article = useMemo(() => annotateArticle(item.text), [item])
  const [rate, setRate] = useState(0.85)
  const [voiceId, setVoiceId] = useState<string>(getVoiceId())
  const [showTranslation, setShowTranslation] = useState(true)
  const [translations, setTranslations] = useState<string[]>([])
  const [playingAll, setPlayingAll] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const cancelRef = useRef(false)

  // 本篇语法重点汇总
  const grammarSummary = useMemo(() => {
    const map = new Map<string, { name: string; explain: string; count: number; example: string }>()
    for (const s of article.sentences) {
      for (const g of s.grammar) {
        const prev = map.get(g.ruleId)
        if (prev) prev.count++
        else map.set(g.ruleId, { name: g.name, explain: g.explain, count: 1, example: s.raw })
      }
    }
    return [...map.values()]
  }, [article])

  // 切换文章：重置播放并加载全文翻译
  useEffect(() => {
    stopSpeak()
    setPlayingAll(false)
    setActiveIdx(-1)
    cancelRef.current = true
    setTranslations([])
    let stale = false
    const raws = article.sentences.map((s) => s.raw)
    if (raws.length > 0) {
      translateBatch(raws, (i, zh) => {
        if (stale) return
        setTranslations((prev) => {
          const next = prev.length === raws.length ? [...prev] : new Array(raws.length).fill('')
          next[i] = zh
          return next
        })
      })
    }
    return () => {
      stale = true
    }
  }, [article])

  useEffect(() => () => stopSpeak(), [])

  const playAll = () => {
    if (playingAll) {
      cancelRef.current = true
      stopSpeak()
      setPlayingAll(false)
      setActiveIdx(-1)
      return
    }
    cancelRef.current = false
    setPlayingAll(true)
    const playNext = (idx: number) => {
      if (cancelRef.current || idx >= article.sentences.length) {
        setPlayingAll(false)
        setActiveIdx(-1)
        return
      }
      setActiveIdx(idx)
      speak(article.sentences[idx].raw, rate, voiceId, () => {
        window.setTimeout(() => playNext(idx + 1), 600)
      })
    }
    playNext(0)
  }

  return (
    <article className="min-w-0 flex-1">
      {/* 标题区 */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-sm font-normal">
          {item.category}
        </Badge>
        <span className="font-meta text-xs text-muted-foreground">{item.source}</span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-meta text-xs text-primary hover:underline"
          >
            原文 <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <h2 className="font-display text-2xl font-bold leading-snug sm:text-[1.75rem]">{item.title}</h2>

      {/* 跟读控制条 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm bg-card px-4 py-3">
        <Button onClick={playAll} size="sm" className="rounded-full">
          {playingAll ? (
            <>
              <Square className="mr-1.5 h-4 w-4" /> 停止跟读
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-4 w-4" /> 开始全文跟读
            </>
          )}
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>发音人</span>
          <Select
            value={voiceId}
            onValueChange={(v) => {
              setVoiceId(v)
              setVoiceIdStored(v)
            }}
          >
            <SelectTrigger className="h-8 w-44 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDGE_VOICES.filter((v) => v.accent === 'en-US').map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  🇺🇸 {v.label}
                </SelectItem>
              ))}
              {EDGE_VOICES.filter((v) => v.accent === 'en-GB').map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  🇬🇧 {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>语速</span>
          <Select value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
            <SelectTrigger className="h-8 w-24 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.6">0.6× 慢</SelectItem>
              <SelectItem value="0.85">0.85× 较慢</SelectItem>
              <SelectItem value="1">1.0× 正常</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Languages className="h-4 w-4" />
          <span>中文翻译</span>
          <Switch checked={showTranslation} onCheckedChange={setShowTranslation} />
        </div>
        <p className="w-full text-xs text-muted-foreground">
          提示：点句子旁的 🔊 单句复读；点橙色标记看重点词义和用法；点任意其他单词也能查词典
        </p>
      </div>

      <Separator className="my-5" />

      {/* 正文 + 学习侧栏 */}
      <div className="flex flex-col gap-8 xl:flex-row">
        <div className="min-w-0 flex-1 divide-y divide-border/70">
          {article.sentences.map((s, i) => (
            <SentenceRow
              key={i}
              index={i}
              sentence={s}
              rate={rate}
              voiceId={voiceId}
              showTranslation={showTranslation}
              translation={translations[i]}
              isActive={activeIdx === i}
              onPlayStateChange={(playing) => {
                if (!playingAll) setActiveIdx(playing ? i : -1)
              }}
            />
          ))}
        </div>

        {/* 生词 / 特殊用法 / 语法重点 */}
        <aside className="w-full shrink-0 space-y-6 xl:w-72">
          {article.vocab.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 border-b border-foreground/40 pb-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold">本篇生词（{article.vocab.length}）</h3>
              </div>
              <ul className="space-y-2.5">
                {article.vocab.map(({ entry }) => (
                  <li key={entry.word} className="text-sm leading-relaxed">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-bold">{entry.word}</span>
                      <span className="text-xs text-muted-foreground">{entry.pos}</span>
                      <button
                        className="ml-auto text-xs text-primary hover:underline"
                        onClick={() => speak(entry.word, 0.9, voiceId)}
                      >
                        朗读
                      </button>
                    </div>
                    <p className="text-muted-foreground">{entry.zh}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {article.usages.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 border-b border-foreground/40 pb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold">特殊用法（{article.usages.length}）</h3>
              </div>
              <ul className="space-y-2.5">
                {article.usages.map(({ entry }) => (
                  <li key={entry.phrase} className="text-sm leading-relaxed">
                    <p className="font-medium text-accent-foreground">{entry.phrase}</p>
                    <p className="text-muted-foreground">{entry.zh}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/80">{entry.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {grammarSummary.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 border-b border-foreground/40 pb-2">
                <Landmark className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold">本篇语法重点（{grammarSummary.length}）</h3>
              </div>
              <ul className="space-y-3">
                {grammarSummary.map((g) => (
                  <li key={g.name} className="text-sm leading-relaxed">
                    <p className="font-medium text-primary">
                      {g.name}
                      <span className="ml-1.5 font-meta text-xs font-normal text-muted-foreground">
                        ×{g.count}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{g.explain}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  )
}
