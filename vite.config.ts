import path from "path"
import crypto from "crypto"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// 微软 Edge 神经网络语音中转：
// 浏览器无法伪造 Origin 直连微软语音服务，由开发服务器代为发起并伪装来源
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const EDGE_WIN_EPOCH = 11644473600
const EDGE_VERSION = '1-143.0.3650.75'

function edgeSecMsGec(): string {
  const secs = Math.floor(Date.now() / 1000) + EDGE_WIN_EPOCH
  const rounded = secs - (secs % 300)
  const ticks = (BigInt(rounded) * 10000000n).toString()
  return crypto.createHash('sha256').update(ticks + EDGE_TOKEN).digest('hex').toUpperCase()
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    proxy: {
      '/edge-tts': {
        target: 'wss://speech.platform.bing.com',
        ws: true,
        changeOrigin: true,
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        },
        rewrite: () =>
          `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TOKEN}&Sec-MS-GEC=${edgeSecMsGec()}&Sec-MS-GEC-Version=${EDGE_VERSION}`,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
