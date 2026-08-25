import { useState } from 'react'
import type { AnnotatedSentence, Segment } from '@/lib/annotate'
import type { WordEntry, UsageEntry } from '@/lib/dictionary'
import { lookupWordOnline, type LookupResult } from '@/lib/lookup'
import { addToWordbook } from '@/lib/wordbook'
import {
  speak,
  stopSpeak,
  isRecognitionSupported,
  recognizeOnce,
  scoreShadowing,
  type ScoreResult,
} from '@/lib/speech'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Volume2, Mic, Square, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Props {
  index: number
  sentence: AnnotatedSentence
  rate: number
  voiceId: string
  translation?: string
  showTranslation: boolean
  isActive: boolean
  onPlayStateChange?: (playing: boolean) => void
}

function VocabChip({ seg, voiceId }: { seg: Segment; voiceId: string }) {
  const entry = seg.entry as WordEntry
  const onOpen = (open: boolean) => {
    if (open) addToWordbook({ kind: 'word', key: entry.word, zh: entry.zh, sub: entry.pos })
  }
  return (
    <Popover onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <span className="vocab-word">{seg.text}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="top">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg font-bold">{entry.word}</span>
          <span className="text-muted-foreground">{entry.pos}</span>
        </div>
        <p className="mt-1 text-base font-medium text-foreground">{entry.zh}</p>
        {entry.usage && (
          <p className="mt-2 border-l-2 border-primary/60 pl-2 text-muted-foreground leading-relaxed">
            {entry.usage}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-primary"
          onClick={() => speak(entry.word, 0.9, voiceId)}
        >
          <Volume2 className="mr-1 h-3.5 w-3.5" /> 朗读单词
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function UsageChip({ seg }: { seg: Segment }) {
  const entry = seg.entry as UsageEntry
  const onOpen = (open: boolean) => {
    if (open) addToWordbook({ kind: 'phrase', key: entry.phrase, zh: entry.zh, sub: entry.note })
  }
  return (
    <Popover onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <span className="usage-phrase">{seg.text}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="top">
        <div className="font-display text-base font-bold text-accent-foreground">{entry.phrase}</div>
        <p className="mt-1 text-base font-medium">{entry.zh}</p>
        <p className="mt-2 border-l-2 border-primary/60 pl-2 text-muted-foreground leading-relaxed">
          {entry.note}
        </p>
      </PopoverContent>
    </Popover>
  )
}

// 任意单词点击查询（内置词库以外的词）
function LookupChip({ word, voiceId }: { word: string; voiceId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [failed, setFailed] = useState(false)

  const onOpen = (open: boolean) => {
    if (!open || result || loading) return
    setLoading(true)
    lookupWordOnline(word)
      .then((r) => {
        if (r) {
          setResult(r)
          addToWordbook({ kind: 'word', key: r.word, zh: r.zh || '', sub: r.pos })
        } else setFailed(true)
      })
      .finally(() => setLoading(false))
  }

  return (
    <Popover onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <span className="lookup-word">{word}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="top">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 查询中…
          </div>
        )}
        {failed && <p className="text-muted-foreground">没查到这个单词，请检查网络后重试</p>}
        {result && (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-bold">{result.word}</span>
              {result.phonetic && <span className="font-meta text-xs text-muted-foreground">{result.phonetic}</span>}
            </div>
            {result.pos && <p className="mt-1 text-xs text-muted-foreground">{result.pos}</p>}
            {result.zh && <p className="mt-1 text-base font-medium text-foreground">{result.zh}</p>}
            {result.en && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.en}</p>}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-primary"
              onClick={() => speak(result.word, 0.9, voiceId)}
            >
              <Volume2 className="mr-1 h-3.5 w-3.5" /> 朗读单词
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

// 把纯文本片段切成可点击的词
function PlainText({ text, voiceId }: { text: string; voiceId: string }) {
  const parts = text.split(/([A-Za-z][A-Za-z'-]*)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^[A-Za-z][A-Za-z'-]*$/.test(p) && p.length > 1 ? (
          <LookupChip key={i} word={p} voiceId={voiceId} />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export default function SentenceRow({
  index,
  sentence,
  rate,
  voiceId,
  translation,
  showTranslation,
  isActive,
  onPlayStateChange,
}: Props) {
  const [playing, setPlaying] = useState(false)
  const [showGrammar, setShowGrammar] = useState(true) // 语法讲解默认展开
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [recError, setRecError] = useState<string | null>(null)
  const canRecognize = isRecognitionSupported()

  const togglePlay = () => {
    if (playing) {
      stopSpeak()
      setPlaying(false)
      onPlayStateChange?.(false)
      return
    }
    setPlaying(true)
    onPlayStateChange?.(true)
    speak(sentence.raw, rate, voiceId, () => {
      setPlaying(false)
      onPlayStateChange?.(false)
    })
  }

  const startRecognize = async () => {
    setRecording(true)
    setResult(null)
    setRecError(null)
    try {
      const said = await recognizeOnce()
      setResult(scoreShadowing(sentence.raw, said))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setRecError(msg === 'timeout' ? '没有听到声音，请靠近麦克风再试一次' : '无法使用麦克风，请检查浏览器权限')
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className={`group py-3 transition-colors ${isActive ? 'sentence-active' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="font-meta mt-1.5 w-6 shrink-0 text-right text-xs text-muted-foreground">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1">
          <p className="font-article text-[1.28rem] leading-[1.85] tracking-[0.005em]">
            {sentence.segments.map((seg, i) =>
              seg.type === 'vocab' ? (
                <VocabChip key={i} seg={seg} voiceId={voiceId} />
              ) : seg.type === 'usage' ? (
                <UsageChip key={i} seg={seg} />
              ) : (
                <PlainText key={i} text={seg.text} voiceId={voiceId} />
              ),
            )}
          </p>
          {showTranslation && (
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
              {translation || '翻译加载中…'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1 opacity-60 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary"
            title={playing ? '停止' : '朗读此句'}
            onClick={togglePlay}
          >
            {playing ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          {canRecognize && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${recording ? 'animate-pulse text-destructive' : 'text-muted-foreground'}`}
              title="跟读评测：先听一遍，再点我复述"
              disabled={recording}
              onClick={startRecognize}
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 语法标签与讲解（默认展开） */}
      {sentence.grammar.length > 0 && (
        <div className="ml-9 mt-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {sentence.grammar.map((g) => (
              <Badge
                key={g.ruleId}
                variant="secondary"
                className="cursor-pointer font-normal hover:bg-accent"
                onClick={() => setShowGrammar((v) => !v)}
              >
                {g.name}
              </Badge>
            ))}
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShowGrammar((v) => !v)}
              title={showGrammar ? '收起语法讲解' : '展开语法讲解'}
            >
              {showGrammar ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          {showGrammar && (
            <div className="mt-2 space-y-2 border-l-2 border-primary/40 pl-3">
              {sentence.grammar.map((g) => (
                <div key={g.ruleId} className="text-sm leading-relaxed">
                  <span className="font-medium text-primary">{g.name}</span>
                  <span className="mx-1.5 font-meta text-xs text-muted-foreground">“{g.excerpt}”</span>
                  <p className="mt-0.5 text-muted-foreground">{g.explain}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 跟读评测结果 */}
      {recording && <p className="ml-9 mt-2 text-sm text-primary">🎙 正在聆听，请复述这句话…</p>}
      {recError && <p className="ml-9 mt-2 text-sm text-destructive">{recError}</p>}
      {result && (
        <div className="ml-9 mt-2 text-sm">
          <span className="font-medium">
            跟读得分：<span className={result.score >= 80 ? 'text-primary' : 'text-foreground'}>{result.score}</span> / 100
          </span>
          {result.missed.length > 0 && (
            <span className="ml-3 text-muted-foreground">
              漏读：{[...new Set(result.missed)].slice(0, 8).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
