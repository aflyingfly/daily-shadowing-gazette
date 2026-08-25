// 语音模块
// 主声源：微软 Edge 神经网络真人语音（经开发服务器 /edge-tts 中转）
// 兜底：本机系统语音（离线也能出声）
import { synthesizeEdge, EDGE_VOICES } from './edgeTts'

const VOICE_KEY = 'shadow-gazette-voice'
export const DEFAULT_VOICE = 'en-US-AvaNeural'

export function getVoiceId(): string {
  return localStorage.getItem(VOICE_KEY) || DEFAULT_VOICE
}

export function setVoiceIdStored(id: string) {
  localStorage.setItem(VOICE_KEY, id)
}

export function voiceAccent(voiceId: string): 'en-US' | 'en-GB' {
  return voiceId.startsWith('en-GB') ? 'en-GB' : 'en-US'
}

// —— 播放状态管理 ——
let playSession = 0
let currentAudio: HTMLAudioElement | null = null

function stopAudio() {
  playSession++ // 使挂起的回调失效
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}

// —— 系统语音（兜底） ——
let cachedVoices: SpeechSynthesisVoice[] = []

function pickLocalVoice(accent: 'en-US' | 'en-GB'): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis?.getVoices() || []
  const quality = /google|samantha|daniel|microsoft|natural|neural|premium|enhanced/i
  return (
    voices.find((v) => v.lang === accent && quality.test(v.name)) ||
    voices.find((v) => v.lang === accent) ||
    voices.find((v) => v.lang.replace('_', '-').startsWith(accent.slice(0, 2))) ||
    null
  )
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  const refresh = () => {
    cachedVoices = window.speechSynthesis.getVoices()
  }
  window.speechSynthesis.onvoiceschanged = refresh
  refresh()
}

function speakLocal(text: string, rate: number, accent: 'en-US' | 'en-GB', onEnd?: () => void) {
  if (!window.speechSynthesis) {
    onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  const voice = pickLocalVoice(accent)
  if (voice) utter.voice = voice
  utter.lang = accent
  utter.rate = rate
  utter.onend = () => onEnd?.()
  utter.onerror = () => onEnd?.()
  window.speechSynthesis.speak(utter)
}

// UI 语速 -> Edge 合成语速百分比
function rateToPct(rate: number): number {
  if (rate <= 0.7) return -40
  if (rate <= 0.92) return -15
  return 0
}

// —— 主接口 ——
export function speak(text: string, rate = 1, voiceId: string = DEFAULT_VOICE, onEnd?: () => void): void {
  stopSpeak()
  const session = playSession
  const accent = voiceAccent(voiceId)

  synthesizeEdge(text, voiceId, rateToPct(rate))
    .then((blob) => {
      if (session !== playSession) return
      const audio = new Audio()
      currentAudio = audio
      const url = URL.createObjectURL(blob)
      audio.src = url
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        onEnd?.()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        if (session === playSession) speakLocal(text, rate, accent, onEnd)
      }
      audio.play().catch(() => {
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        if (session === playSession) speakLocal(text, rate, accent, onEnd)
      })
    })
    .catch(() => {
      if (session === playSession) speakLocal(text, rate, accent, onEnd)
    })
}

export function stopSpeak(): void {
  stopAudio()
  window.speechSynthesis?.cancel()
}

export { EDGE_VOICES }

// —— 跟读评测 ——
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition as RecognitionCtor) || (w.webkitSpeechRecognition as RecognitionCtor) || null
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null
}

export function recognizeOnce(timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      reject(new Error('unsupported'))
      return
    }
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    const timer = window.setTimeout(() => {
      rec.abort()
      reject(new Error('timeout'))
    }, timeoutMs)
    rec.onresult = (ev) => {
      window.clearTimeout(timer)
      const transcript = ev.results?.[0]?.[0]?.transcript || ''
      resolve(transcript)
    }
    rec.onerror = (ev) => {
      window.clearTimeout(timer)
      reject(new Error(ev.error || 'error'))
    }
    rec.start()
  })
}

export interface ScoreResult {
  score: number
  matched: string[]
  missed: string[]
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

export function scoreShadowing(target: string, said: string): ScoreResult {
  const targetWords = tokenizeWords(target)
  const saidWords = new Set(tokenizeWords(said))
  const matched: string[] = []
  const missed: string[] = []
  for (const w of targetWords) {
    if (saidWords.has(w)) matched.push(w)
    else missed.push(w)
  }
  const score = targetWords.length === 0 ? 0 : Math.round((matched.length / targetWords.length) * 100)
  return { score, matched, missed }
}
