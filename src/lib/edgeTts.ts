// 微软 Edge 神经网络语音客户端
// 通过开发服务器的 /edge-tts 中转连接微软语音服务（浏览器直连会因 Origin 校验被拒）

export interface EdgeVoice {
  id: string
  label: string
  accent: 'en-US' | 'en-GB'
}

export const EDGE_VOICES: EdgeVoice[] = [
  { id: 'en-US-AvaNeural', label: 'Ava（女声·清晰）', accent: 'en-US' },
  { id: 'en-US-AndrewNeural', label: 'Andrew（男声·沉稳）', accent: 'en-US' },
  { id: 'en-US-EmmaNeural', label: 'Emma（女声·亲切）', accent: 'en-US' },
  { id: 'en-US-BrianNeural', label: 'Brian（男声·温和）', accent: 'en-US' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia（女声·伦敦音）', accent: 'en-GB' },
  { id: 'en-GB-RyanNeural', label: 'Ryan（男声·英伦腔）', accent: 'en-GB' },
]

// 合成结果缓存：同一句话重复跟读不必重新合成
const cache = new Map<string, Promise<Blob>>()

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function uuid(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

function timestamp(): string {
  return new Date().toISOString()
}

function synthesize(text: string, voice: string, ratePct: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/edge-tts`)
    ws.binaryType = 'arraybuffer'
    const chunks: ArrayBuffer[] = []
    let settled = false

    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      fn()
    }

    const timer = window.setTimeout(() => done(() => reject(new Error('edge-tts timeout'))), 10000)
    ws.onerror = () => done(() => reject(new Error('edge-tts ws error')))
    ws.onclose = (e) => {
      if (!settled && e.code !== 1000) done(() => reject(new Error('edge-tts closed ' + e.code)))
    }

    ws.onopen = () => {
      const config =
        `X-Timestamp:${timestamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        })
      ws.send(config)
      const rate = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>` +
        `${escapeXml(text)}</prosody></voice></speak>`
      ws.send(
        `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp()}\r\nPath:ssml\r\n\r\n${ssml}`,
      )
    }

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        if (ev.data.includes('Path:turn.end')) {
          done(() => resolve(new Blob(chunks, { type: 'audio/mpeg' })))
        }
        return
      }
      const buf = new Uint8Array(ev.data as ArrayBuffer)
      const headerLen = (buf[0] << 8) | buf[1]
      const header = new TextDecoder().decode(buf.slice(2, 2 + headerLen))
      if (header.includes('Path:audio')) {
        chunks.push((ev.data as ArrayBuffer).slice(2 + headerLen))
      }
    }
  })
}

// 对外接口：合成语音（带缓存）。失败时抛错，由调用方回退到系统语音
export function synthesizeEdge(text: string, voice: string, ratePct: number): Promise<Blob> {
  const key = `${voice}|${ratePct}|${text}`
  let p = cache.get(key)
  if (!p) {
    p = synthesize(text, voice, ratePct)
    cache.set(key, p)
    // 失败结果不缓存
    p.catch(() => cache.delete(key))
    // 缓存最多 200 条
    if (cache.size > 200) {
      const first = cache.keys().next().value
      if (first) cache.delete(first)
    }
  }
  return p
}
