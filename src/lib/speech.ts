// 语音模块
// 本地声源：微软 Edge 神经网络真人语音（经开发服务器 /edge-tts 中转）
// 线上首选：Google 翻译语音（音质自然，美/英音可选，带卡死看门狗）
// 线上备用：百度翻译语音（国内网络稳定）
// 兜底：本机系统语音（离线也能出声）
import { synthesizeEdge, EDGE_VOICES } from './edgeTts'

// 只有本地开发服务器才有 /edge-tts 中转；线上静态托管直接跳过 Edge 尝试，
// 避免 WebSocket 连接挂起 10 秒耗尽浏览器"用户点击"授权窗口，导致后续播放被拦截
const IS_LOCAL_DEV =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '')

// 页面加载时探测 Google 声源是否可达（3 秒超时）。
// 不可达则直接首选百度，避免点击播放时白白等待、耗尽浏览器"用户点击"授权窗口
let googleReachable: boolean | null = null
if (!IS_LOCAL_DEV && typeof fetch !== 'undefined') {
  const probeUrl = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=hi&total=1&idx=0'
  Promise.race([
    fetch(probeUrl, { mode: 'no-cors' }).then(() => true),
    new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 3000)),
  ])
    .then((ok) => {
      googleReachable = ok
    })
    .catch(() => {
      googleReachable = false
    })
}

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

// —— Google 翻译语音（线上首选声源） ——
// Audio 元素播放音频不受跨域限制，GitHub Pages 等静态托管可直接使用
// 接口单次限制约 200 字符，长文本按词边界切块依次播放
// 每块加"卡死看门狗"：几秒内加载不出数据就自动放弃，转交百度声源
const STALL_TIMEOUT = 3500

function chunkForTts(text: string, maxLen = 180): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let rest = text
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(' ', maxLen)
    if (cut < maxLen / 2) cut = maxLen
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

function speakGoogle(text: string, rate: number, accent: 'en-US' | 'en-GB', onEnd?: () => void) {
  const tl = accent === 'en-GB' ? 'en-GB' : 'en'
  const chunks = chunkForTts(text)
  const session = playSession
  let idx = 0
  let stallTimer = 0

  const fail = () => {
    window.clearTimeout(stallTimer)
    if (session === playSession) speakBaidu(text, rate, accent, onEnd)
  }

  const playNext = () => {
    if (session !== playSession) return
    if (idx >= chunks.length) {
      onEnd?.()
      return
    }
    const q = encodeURIComponent(chunks[idx])
    const audio = new Audio(`https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${q}&total=1&idx=0`)
    currentAudio = audio
    audio.playbackRate = rate
    stallTimer = window.setTimeout(() => {
      // 超时还没加载出可播放数据，判定为卡死
      if (audio.readyState < 3) {
        if (currentAudio === audio) currentAudio = null
        fail()
      }
    }, STALL_TIMEOUT)
    audio.onended = () => {
      window.clearTimeout(stallTimer)
      if (currentAudio === audio) currentAudio = null
      idx++
      playNext()
    }
    audio.onerror = () => {
      window.clearTimeout(stallTimer)
      if (currentAudio === audio) currentAudio = null
      fail()
    }
    audio.play().catch(() => {
      window.clearTimeout(stallTimer)
      if (currentAudio === audio) currentAudio = null
      fail()
    })
  }
  playNext()
}

// —— 百度翻译语音（线上备用声源，国内网络稳定） ——
// spd 为朗读速度档位（英文 1-9，3 约为正常语速）
function rateToSpd(rate: number): number {
  if (rate <= 0.7) return 2
  if (rate <= 0.92) return 3
  return 4
}

function speakBaidu(text: string, rate: number, accent: 'en-US' | 'en-GB', onEnd?: () => void) {
  const spd = rateToSpd(rate)
  const chunks = chunkForTts(text)
  const session = playSession
  let idx = 0
  let stallTimer = 0

  const fail = () => {
    window.clearTimeout(stallTimer)
    if (session === playSession) speakLocal(text, rate, accent, onEnd)
  }

  const playNext = () => {
    if (session !== playSession) return
    if (idx >= chunks.length) {
      onEnd?.()
      return
    }
    const q = encodeURIComponent(chunks[idx])
    const audio = new Audio(`https://fanyi.baidu.com/gettts?lan=en&spd=${spd}&source=web&text=${q}`)
    currentAudio = audio
    stallTimer = window.setTimeout(() => {
      if (audio.readyState < 3) {
        if (currentAudio === audio) currentAudio = null
        fail()
      }
    }, STALL_TIMEOUT)
    audio.onended = () => {
      window.clearTimeout(stallTimer)
      if (currentAudio === audio) currentAudio = null
      idx++
      playNext()
    }
    audio.onerror = () => {
      window.clearTimeout(stallTimer)
      if (currentAudio === audio) currentAudio = null
      fail()
    }
    audio.play().catch(() => {
      window.clearTimeout(stallTimer)
      if (currentAudio === audio) currentAudio = null
      fail()
    })
  }
  playNext()
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

  // 线上静态托管：没有 /edge-tts 中转。
  // Google 探测失败时直接用百度（国内网络稳定），保住点击授权时效
  if (!IS_LOCAL_DEV) {
    if (googleReachable === false) speakBaidu(text, rate, accent, onEnd)
    else speakGoogle(text, rate, accent, onEnd)
    return
  }

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
      if (session === playSession) speakGoogle(text, rate, accent, onEnd)
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
