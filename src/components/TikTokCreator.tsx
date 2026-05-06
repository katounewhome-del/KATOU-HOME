import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { generateSeedanceVideo, loadVideoElement, type SeedanceProgressUpdate } from '../api/seedance'

// ─── Types ───────────────────────────────────────────────────────────────────

type Template = 'gradient' | 'dark' | 'minimal' | 'psych'
type BgPreset = 'none' | 'space' | 'sakura' | 'neon' | 'forest' | 'cinema_city' | 'warp' | 'aurora'
type ExportState = 'idle' | 'encoding' | 'done'
type PreviewView = 'canvas' | 'video'

interface VideoConfig {
  title: string
  subtitle: string
  hashtags: string
  bgColor1: string
  bgColor2: string
  textColor: string
  duration: number
  template: Template
}

interface PsychFact {
  number: string
  title: string
  subtitle: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 540
const CANVAS_H = 960
const CANVAS_SCALE = 2 // Output at 1080x1920 (TikTok-recommended full size)
const OUTPUT_W = CANVAS_W * CANVAS_SCALE
const OUTPUT_H = CANVAS_H * CANVAS_SCALE
const FPS = 30

const PSYCH_FACTS: PsychFact[] = [
  { number: 'No.1', title: '既読スルーの真実', subtitle: '返信が遅い人＝冷たい、ではありません。完璧主義の人ほど言葉を選ぶので時間がかかるんです。' },
  { number: 'No.2', title: '0.1秒で決まる第一印象', subtitle: 'プリンストン大学の研究で、人は0.1秒で相手の信頼度を判断していることが判明しています。' },
  { number: 'No.3', title: '会えば会うほど好きになる', subtitle: '単純接触効果（ザイオンス効果）。同じ人と繰り返し会うだけで、好感度は確実に上がります。' },
  { number: 'No.4', title: '吊り橋の上で恋に落ちる', subtitle: 'ドキドキを恋と勘違いする心理。刺激的な体験を共有すると、相手への好感度が上がります。' },
  { number: 'No.5', title: '名前を呼ぶ魔法', subtitle: '会話で相手の名前を呼ぶだけで信頼度が上がる。脳が「特別扱いされている」と感じるからです。' },
  { number: 'No.6', title: 'うなずきの威力', subtitle: '相手の話に3回うなずくだけで好感度UP。聞き上手と呼ばれる人が必ずやっている技術です。' },
  { number: 'No.7', title: '最初の3秒で謝れ', subtitle: '怒られた瞬間、3秒以内の謝罪は怒りを和らげます。言い訳より先に「ごめんなさい」が正解。' },
  { number: 'No.8', title: '夜の決断は危険', subtitle: '判断力は夜になるほど低下します。大事な決断、告白、契約は朝にしましょう。' },
  { number: 'No.9', title: '姿勢で性格が変わる', subtitle: '2分間胸を張るだけで自信ホルモンが増加。プレゼン前のおまじないに使える研究結果です。' },
  { number: 'No.10', title: '別れ際が9割', subtitle: 'ピーク・エンドの法則。体験の印象は最高の瞬間と終わり方で決まります。最後に笑顔を。' },
]

// ─── Utilities ───────────────────────────────────────────────────────────────

function easeOut(progress: number, start: number, end: number): number {
  const t = Math.min(1, Math.max(0, (progress - start) / (end - start)))
  return 1 - Math.pow(1 - t, 3)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
  const chars = Array.from(text)
  let line = ''
  let currentY = y
  for (const char of chars) {
    const test = line + char
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line, x, currentY)
      line = char
      currentY += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, currentY)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ─── Background Presets ──────────────────────────────────────────────────────

function drawBgPreset(ctx: CanvasRenderingContext2D, preset: BgPreset, t: number) {
  const w = CANVAS_W, h = CANVAS_H
  if (preset === 'space') {
    ctx.fillStyle = '#040412'
    ctx.fillRect(0, 0, w, h)
    const nb = ctx.createRadialGradient(w * 0.3, h * 0.38, 0, w * 0.3, h * 0.38, h * 0.42)
    nb.addColorStop(0, 'rgba(90,0,200,0.28)')
    nb.addColorStop(1, 'transparent')
    ctx.fillStyle = nb
    ctx.fillRect(0, 0, w, h)
    const nb2 = ctx.createRadialGradient(w * 0.75, h * 0.6, 0, w * 0.75, h * 0.6, h * 0.3)
    nb2.addColorStop(0, 'rgba(0,60,160,0.22)')
    nb2.addColorStop(1, 'transparent')
    ctx.fillStyle = nb2
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 140; i++) {
      const sx = (i * 137.508) % w
      const sy = (i * 97.381) % h
      const b = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.9 + i * 0.43))
      ctx.fillStyle = `rgba(255,255,255,${b})`
      ctx.beginPath()
      ctx.arc(sx, sy, 0.8 + (i % 3) * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (preset === 'sakura') {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#ffe8f0')
    g.addColorStop(1, '#ffd0e2')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 30; i++) {
      const speed = 0.5 + (i % 4) * 0.28
      const px = ((i * 173.5 + t * 28 * speed) % (w + 100)) - 50
      const py = ((i * 97.3 + t * 55 * speed) % (h + 80)) - 40
      const angle = t * (0.4 + i * 0.08) + i * 0.9
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(angle)
      ctx.fillStyle = `rgba(255,130,165,${0.38 + (i % 4) * 0.12})`
      ctx.beginPath()
      ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  } else if (preset === 'neon') {
    ctx.fillStyle = '#03030a'
    ctx.fillRect(0, 0, w, h)
    const gs = 56
    const p = 0.28 + 0.18 * Math.sin(t * 1.4)
    ctx.strokeStyle = `rgba(0,255,200,${p})`
    ctx.lineWidth = 0.5
    for (let x = 0; x <= w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y <= h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    for (let i = 0; i < 10; i++) {
      const gx = Math.round(((i * 137.5) % w) / gs) * gs
      const gy = Math.round(((i * 97.3) % h) / gs) * gs
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 35)
      gr.addColorStop(0, `rgba(0,255,200,${0.5 + 0.3 * Math.sin(t * 2 + i)})`)
      gr.addColorStop(1, 'transparent')
      ctx.fillStyle = gr
      ctx.fillRect(gx - 35, gy - 35, 70, 70)
    }
    const mg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, h * 0.5)
    mg.addColorStop(0, 'rgba(255,0,120,0.08)')
    mg.addColorStop(1, 'transparent')
    ctx.fillStyle = mg
    ctx.fillRect(0, 0, w, h)
  } else if (preset === 'cinema_city') {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#1a0533'); sky.addColorStop(0.5, '#3a0a55'); sky.addColorStop(1, '#5a1a30')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.508) % w; const sy = (i * 97.381) % (h * 0.55)
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 1.5 + i)})`
      ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill()
    }
    const moonGlow = ctx.createRadialGradient(w * 0.78, h * 0.18, 0, w * 0.78, h * 0.18, 90)
    moonGlow.addColorStop(0, 'rgba(255,250,200,0.55)'); moonGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = moonGlow; ctx.fillRect(w * 0.78 - 90, h * 0.18 - 90, 180, 180)
    ctx.fillStyle = '#fff5d8'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.18, 38, 0, Math.PI * 2); ctx.fill()
    const buildings: [number, number, number, number][] = [[0,0.66,0.18,0.34],[0.16,0.55,0.16,0.45],[0.31,0.62,0.13,0.38],[0.43,0.48,0.17,0.52],[0.59,0.6,0.13,0.4],[0.71,0.46,0.15,0.54],[0.85,0.62,0.15,0.38]]
    for (const [bx, by, bw2, bh2] of buildings) {
      ctx.fillStyle = '#0a0518'; ctx.fillRect(bx * w, by * h, bw2 * w, bh2 * h)
      const cols = 4, rows = Math.max(4, Math.floor(bh2 * 16))
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wx = bx * w + (bw2 * w / cols) * c + 5
        const wy = by * h + (bh2 * h / rows) * r + 5
        const ww = bw2 * w / cols - 10, wh2 = bh2 * h / rows - 10
        if (wh2 < 3 || ww < 3) continue
        const seed = bx * 1000 + by * 100 + r * 10 + c
        const on = Math.sin(t * 0.6 + seed * 0.7) > 0.2
        ctx.fillStyle = on ? `rgba(255, 215, 100, ${0.55 + 0.35 * Math.sin(t * 2.5 + seed)})` : 'rgba(40, 25, 50, 0.7)'
        ctx.fillRect(wx, wy, ww, wh2)
      }
    }
    ctx.fillStyle = 'rgba(255,170,0,0.85)'
    for (let i = 0; i < 6; i++) {
      const lx = ((t * 60 + i * 110) % (w + 60)) - 30
      ctx.fillRect(lx, h * 0.94, 36, 4); ctx.fillRect(lx + 6, h * 0.96, 26, 3)
    }
  } else if (preset === 'warp') {
    ctx.fillStyle = '#000007'; ctx.fillRect(0, 0, w, h)
    const cx = w / 2, cy = h / 2
    for (let i = 0; i < 220; i++) {
      const seed = i * 137.508
      const angle = (seed * 0.0173) % (Math.PI * 2)
      const speed = 0.4 + ((seed * 7) % 100) / 100
      const phase = ((seed * 17) % 1000) / 1000
      const dist = ((t * speed * 280 + phase * 700) % 700)
      if (dist < 5 || dist > 700) continue
      const x1 = cx + Math.cos(angle) * dist
      const y1 = cy + Math.sin(angle) * dist
      const x2 = cx + Math.cos(angle) * (dist + dist * 0.18)
      const y2 = cy + Math.sin(angle) * (dist + dist * 0.18)
      const intensity = Math.min(1, dist / 300)
      const hue = (seed % 60) - 30
      ctx.strokeStyle = `rgba(${180 + hue}, ${200 + hue * 0.5}, 255, ${intensity * 0.95})`
      ctx.lineWidth = 0.8 + intensity * 1.6
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130)
    gg.addColorStop(0, 'rgba(120,180,255,0.45)'); gg.addColorStop(0.5, 'rgba(80,100,200,0.15)'); gg.addColorStop(1, 'transparent')
    ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h)
  } else if (preset === 'aurora') {
    ctx.fillStyle = '#020812'; ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 90; i++) {
      const sx = (i * 137.508) % w; const sy = (i * 97.381) % (h * 0.7)
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.sin(t * 1.3 + i * 0.7)})`
      ctx.beginPath(); ctx.arc(sx, sy, 0.9, 0, Math.PI * 2); ctx.fill()
    }
    for (let layer = 0; layer < 3; layer++) {
      ctx.save(); ctx.globalAlpha = 0.42 - layer * 0.1
      const palette: [string, string][] = [['#10ff90', '#80ff50'], ['#40c0ff', '#9050ff'], ['#ff60d0', '#ff9050']]
      const [c1, c2] = palette[layer]
      const grad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.7)
      grad.addColorStop(0, 'transparent'); grad.addColorStop(0.4, c1); grad.addColorStop(0.85, c2); grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.moveTo(0, h * 0.55)
      for (let x = 0; x <= w; x += 8) {
        const wave = Math.sin(x * 0.012 + t * 0.55 + layer * 1.4) * 32
        const wave2 = Math.sin(x * 0.005 + t * 0.32 + layer * 2.1) * 55
        ctx.lineTo(x, h * 0.32 + wave + wave2 + layer * 28)
      }
      for (let x = w; x >= 0; x -= 8) {
        const wave = Math.sin(x * 0.014 + t * 0.45 + layer * 0.9) * 32
        ctx.lineTo(x, h * 0.62 + wave + layer * 28)
      }
      ctx.closePath(); ctx.fill(); ctx.restore()
    }
    ctx.fillStyle = '#000610'
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * 0.78)
    ctx.lineTo(w * 0.14, h * 0.66); ctx.lineTo(w * 0.28, h * 0.72)
    ctx.lineTo(w * 0.43, h * 0.55); ctx.lineTo(w * 0.58, h * 0.62)
    ctx.lineTo(w * 0.76, h * 0.5); ctx.lineTo(w * 0.9, h * 0.6)
    ctx.lineTo(w, h * 0.7); ctx.lineTo(w, h); ctx.closePath(); ctx.fill()
  } else if (preset === 'forest') {
    const fg = ctx.createLinearGradient(0, 0, 0, h)
    fg.addColorStop(0, '#061408')
    fg.addColorStop(0.5, '#0a200b')
    fg.addColorStop(1, '#152808')
    ctx.fillStyle = fg
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    for (let i = 0; i < 7; i++) {
      const rx = w * (0.08 + i * 0.14) + Math.sin(t * 0.28 + i) * 18
      const alpha = 0.035 + 0.025 * Math.sin(t * 0.7 + i * 0.8)
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#ffe8a0'
      ctx.beginPath()
      ctx.moveTo(rx - 18, 0); ctx.lineTo(rx + 18, 0)
      ctx.lineTo(rx + 55, h); ctx.lineTo(rx - 55, h)
      ctx.closePath(); ctx.fill()
    }
    ctx.restore()
    for (let i = 0; i < 22; i++) {
      const px = ((i * 173.5 + t * 14) % w)
      const py = ((i * 97.3 - t * 22 + h * 2) % h)
      ctx.fillStyle = `rgba(255,225,130,${0.25 + 0.18 * Math.sin(t + i)})`
      ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill()
    }
  }
}

// ─── Character ───────────────────────────────────────────────────────────────

function drawCharacter(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, mouthOpen: number, blinking: boolean) {
  // Body
  const bodyG = ctx.createLinearGradient(cx - r * 0.6, cy + r, cx + r * 0.6, cy + r * 2.4)
  bodyG.addColorStop(0, '#6d28d9'); bodyG.addColorStop(1, '#4c1d95')
  ctx.fillStyle = bodyG
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 1.7, r * 0.68, r * 0.88, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ddd6fe'
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.95, r * 0.32, r * 0.2, 0, 0, Math.PI * 2); ctx.fill()

  // Head shadow
  ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(cx + 5, cy + 5, r, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()

  // Head
  const hg = ctx.createRadialGradient(cx - r * 0.22, cy - r * 0.28, r * 0.08, cx, cy, r)
  hg.addColorStop(0, '#ffe0b2'); hg.addColorStop(1, '#ffcc80')
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()

  // Hair
  ctx.fillStyle = '#4c1d95'
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.04, Math.PI * 1.96); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill()
  const tufts: [number, number, number][] = [[-0.52, -0.8, 0.31], [-0.1, -0.99, 0.35], [0.3, -0.9, 0.29], [0.65, -0.68, 0.25]]
  for (const [dx, dy, sz] of tufts) {
    ctx.fillStyle = '#5b21b6'; ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, sz * r, 0, Math.PI * 2); ctx.fill()
  }

  // Ears
  for (const [sign, ex] of [[-1, cx - r * 0.93], [1, cx + r * 0.93]] as [number, number][]) {
    ctx.fillStyle = '#ffcc80'; ctx.beginPath(); ctx.ellipse(ex, cy + r * 0.05, r * 0.22, r * 0.28, sign * 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.ellipse(ex, cy + r * 0.05, r * 0.13, r * 0.16, sign * 0.3, 0, Math.PI * 2); ctx.fill()
  }

  const eyeY = cy - r * 0.08
  const eyeX = r * 0.32

  if (blinking) {
    ctx.strokeStyle = '#4a2800'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(cx - eyeX, eyeY + r * 0.07, r * 0.16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx + eyeX, eyeY + r * 0.07, r * 0.16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke()
  } else {
    for (const ex of [cx - eyeX, cx + eyeX]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, eyeY, r * 0.21, r * 0.26, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#6d28d9'; ctx.beginPath(); ctx.ellipse(ex + r * 0.02, eyeY + r * 0.02, r * 0.13, r * 0.17, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1a0a2e'; ctx.beginPath(); ctx.ellipse(ex + r * 0.02, eyeY + r * 0.02, r * 0.07, r * 0.1, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + r * 0.08, eyeY - r * 0.07, r * 0.055, 0, Math.PI * 2); ctx.fill()
    }
    ctx.strokeStyle = '#4a2800'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round'
    for (const [sign, lx] of [[-1, cx - eyeX], [1, cx + eyeX]] as [number, number][]) {
      ctx.beginPath(); ctx.moveTo(lx - r * 0.13, eyeY - r * 0.22); ctx.lineTo(lx - r * 0.18 * sign, eyeY - r * 0.3); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(lx + r * 0.13, eyeY - r * 0.22); ctx.lineTo(lx + r * 0.18 * sign, eyeY - r * 0.3); ctx.stroke()
    }
  }

  // Eyebrows
  ctx.strokeStyle = '#4a2800'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'
  for (const ex of [cx - eyeX, cx + eyeX]) {
    ctx.beginPath(); ctx.moveTo(ex - r * 0.17, eyeY - r * 0.36); ctx.quadraticCurveTo(ex, eyeY - r * 0.44, ex + r * 0.17, eyeY - r * 0.36); ctx.stroke()
  }

  // Blush
  ctx.save(); ctx.globalAlpha = 0.38; ctx.fillStyle = '#ff7096'
  ctx.beginPath(); ctx.ellipse(cx - eyeX * 1.75, eyeY + r * 0.35, r * 0.25, r * 0.13, -0.15, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(cx + eyeX * 1.75, eyeY + r * 0.35, r * 0.25, r * 0.13, 0.15, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Nose
  ctx.fillStyle = '#cc8844'
  ctx.beginPath(); ctx.arc(cx - r * 0.07, cy + r * 0.22, r * 0.035, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + r * 0.07, cy + r * 0.22, r * 0.035, 0, Math.PI * 2); ctx.fill()

  // Mouth
  const mouthY = cy + r * 0.45
  const mouthW = r * 0.36
  if (mouthOpen < 0.05) {
    ctx.strokeStyle = '#bf5050'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(cx, mouthY + r * 0.05, mouthW * 0.75, 0.15, Math.PI - 0.15); ctx.stroke()
  } else {
    const oh = mouthOpen * r * 0.34
    ctx.fillStyle = '#bf2020'; ctx.beginPath(); ctx.ellipse(cx, mouthY, mouthW, oh, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, mouthY - oh * 0.15, mouthW * 0.75, oh * 0.45, 0, 0, Math.PI); ctx.fill()
    ctx.fillStyle = '#ff8080'; ctx.beginPath(); ctx.ellipse(cx, mouthY + oh * 0.2, mouthW * 0.45, oh * 0.38, 0, 0, Math.PI); ctx.fill()
  }
}

// ─── Audio generation ─────────────────────────────────────────────────────────

function generateAudioSamples(duration: number): Float32Array {
  const sr = 44100
  const n = Math.floor(duration * sr)
  const out = new Float32Array(n)
  const ts = duration * 0.42
  const te = duration * 0.78

  // A-minor ambient pad
  for (const freq of [110, 130.81, 164.81, 196.0, 220.0]) {
    for (let i = 0; i < n; i++) {
      const t = i / sr
      const env = Math.min(1, t / 2.0) * Math.min(1, (duration - t) / 2.0)
      out[i] += Math.sin(2 * Math.PI * freq * t) * 0.016 * env
    }
  }

  // Talking voice texture
  for (const freq of [200, 280, 360, 460]) {
    for (let i = 0; i < n; i++) {
      const t = i / sr
      if (t >= ts && t <= te) {
        const syllable = Math.max(0, Math.sin(t * Math.PI * 2 * 4.4))
        out[i] += Math.sin(2 * Math.PI * freq * t) * 0.022 * syllable
        out[i] += Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.008 * syllable
      }
    }
  }

  let maxAbs = 0
  for (const s of out) if (Math.abs(s) > maxAbs) maxAbs = Math.abs(s)
  if (maxAbs > 0.85) for (let i = 0; i < n; i++) out[i] *= 0.85 / maxAbs

  return out
}

// ─── MP4 / WebM export ────────────────────────────────────────────────────────

async function exportVideo(
  canvas: HTMLCanvasElement,
  drawFnSync: (ctx: CanvasRenderingContext2D, t: number) => void,
  drawFnAsync: (ctx: CanvasRenderingContext2D, t: number) => Promise<void>,
  duration: number,
  onProgress: (p: number) => void,
): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> {
  const hasWebCodecs =
    typeof VideoEncoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof AudioData !== 'undefined'

  if (!hasWebCodecs) {
    const blob = await exportWebM(canvas, drawFnSync, duration, onProgress)
    return { blob, ext: 'webm' }
  }

  try {
    const blob = await exportMP4(canvas, drawFnAsync, duration, onProgress)
    return { blob, ext: 'mp4' }
  } catch {
    const blob = await exportWebM(canvas, drawFnSync, duration, onProgress)
    return { blob, ext: 'webm' }
  }
}

async function exportMP4(
  canvas: HTMLCanvasElement,
  drawFn: (ctx: CanvasRenderingContext2D, t: number) => Promise<void>,
  duration: number,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const ctx = canvas.getContext('2d')!
  const totalFrames = Math.floor(duration * FPS)
  const sr = 44100

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: OUTPUT_W, height: OUTPUT_H },
    audio: { codec: 'aac', sampleRate: sr, numberOfChannels: 1 },
    firstTimestampBehavior: 'offset',
    fastStart: 'in-memory',
  })

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
    error: (e) => { throw e },
  })
  videoEncoder.configure({
    codec: 'avc1.640028', // H.264 High Profile Level 4.0 — supports 1080p
    width: OUTPUT_W,
    height: OUTPUT_H,
    bitrate: 8_000_000, // 8 Mbps for crisp 1080×1920
    framerate: FPS,
  })

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta!),
    error: (e) => { throw e },
  })
  audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 1, bitrate: 128_000 })

  // Encode audio as a single pre-generated chunk
  const samples = generateAudioSamples(duration)
  const audioData = new AudioData({ format: 'f32', sampleRate: sr, numberOfFrames: samples.length, numberOfChannels: 1, timestamp: 0, data: samples.buffer as ArrayBuffer })
  audioEncoder.encode(audioData)
  audioData.close()

  // Encode video frames offline (faster than real-time)
  for (let i = 0; i < totalFrames; i++) {
    await drawFn(ctx, i / FPS)
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i / FPS) * 1_000_000) })
    while (videoEncoder.encodeQueueSize > 12) await new Promise<void>(r => setTimeout(r, 4))
    videoEncoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 })
    frame.close()
    onProgress(Math.round((i / totalFrames) * 88))
    if (i % 12 === 0) await new Promise<void>(r => setTimeout(r, 0))
  }

  onProgress(92)
  await Promise.all([videoEncoder.flush(), audioEncoder.flush()])
  muxer.finalize()
  onProgress(100)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}

function exportWebM(
  canvas: HTMLCanvasElement,
  drawFn: (ctx: CanvasRenderingContext2D, t: number) => void,
  duration: number,
  onProgress: (p: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d')!
    const audioCtx = new AudioContext()
    const dest = audioCtx.createMediaStreamDestination()

    // Ambient audio
    const now = audioCtx.currentTime
    for (const freq of [110, 130.81, 164.81, 220]) {
      const osc = audioCtx.createOscillator(); const g = audioCtx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.018, now + 1.5)
      g.gain.linearRampToValueAtTime(0.018, now + duration - 1); g.gain.linearRampToValueAtTime(0, now + duration)
      osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + duration + 0.1)
    }
    for (const freq of [200, 280, 360]) {
      const osc = audioCtx.createOscillator(); const g = audioCtx.createGain()
      osc.type = 'triangle'; osc.frequency.value = freq; g.gain.setValueAtTime(0, now)
      const ts = duration * 0.42; const te = duration * 0.78; const syllRate = 4.4
      for (let si = 0; si < Math.floor((te - ts) * syllRate); si++) {
        const st = now + ts + si / syllRate
        g.gain.setValueAtTime(0.02, st); g.gain.setValueAtTime(0, st + 0.09)
      }
      osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + duration + 0.1)
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm'
    const videoStream = canvas.captureStream(FPS)
    const combined = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
    const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 })
    const chunks: Blob[] = []

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      audioCtx.close()
      resolve(new Blob(chunks, { type: 'video/webm' }))
    }
    recorder.onerror = reject
    recorder.start()

    let recStart: number | null = null
    const loop = (ts: number) => {
      if (!recStart) recStart = ts
      const elapsed = (ts - recStart) / 1000
      if (elapsed >= duration) { recorder.stop(); return }
      drawFn(ctx, elapsed)
      onProgress(Math.round((elapsed / duration) * 100))
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TikTokCreator() {
  const [config, setConfig] = useState<VideoConfig>({
    title: '返報性の原理',
    subtitle: '何かをしてもらうと「お返しをしなければ」という気持ちになる心理。セールスや恋愛でもよく使われます。',
    hashtags: '#心理学 #豆知識 #雑学 #tiktok',
    bgColor1: '#ff0050', bgColor2: '#00f2ea', textColor: '#ffffff',
    duration: 12, template: 'psych',
  })
  const [psychNum, setPsychNum] = useState('No.1')
  const [showCharacter, setShowCharacter] = useState(true)
  const [bgPreset, setBgPreset] = useState<BgPreset>('space')
  const [bgImageEl, setBgImageEl] = useState<HTMLImageElement | null>(null)
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [progress, setProgress] = useState(0)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedExt, setGeneratedExt] = useState<'mp4' | 'webm'>('mp4')
  const [previewView, setPreviewView] = useState<PreviewView>('canvas')
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Seedance state
  const [seedanceApiKey, setSeedanceApiKey] = useState(() => localStorage.getItem('seedance_api_key') ?? '')
  const [seedancePrompt, setSeedancePrompt] = useState('夜の渋谷の街並み、ネオンの光、雨上がり、シネマティック')
  const [seedanceResolution, setSeedanceResolution] = useState<'480p' | '720p' | '1080p'>('720p')
  const [seedanceDuration, setSeedanceDuration] = useState<'5' | '10'>('5')
  const [seedanceVideoEl, setSeedanceVideoEl] = useState<HTMLVideoElement | null>(null)
  const [seedanceStatus, setSeedanceStatus] = useState<SeedanceProgressUpdate | null>(null)
  const [seedanceError, setSeedanceError] = useState<string>('')
  const seedanceAbortRef = useRef<AbortController | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef<number>(0)
  const previewStartRef = useRef<number | null>(null)
  const urlCleanupRef = useRef<string | null>(null)

  useEffect(() => () => { if (urlCleanupRef.current) URL.revokeObjectURL(urlCleanupRef.current) }, [])
  useEffect(() => { localStorage.setItem('seedance_api_key', seedanceApiKey) }, [seedanceApiKey])

  // ── Draw background layer ───────────────────────────────────────────────────

  const drawBg = useCallback((ctx: CanvasRenderingContext2D, t: number, defaultDark: boolean) => {
    const w = CANVAS_W, h = CANVAS_H
    if (seedanceVideoEl && seedanceVideoEl.readyState >= 2) {
      const v = seedanceVideoEl
      const va = v.videoWidth / v.videoHeight
      const ca = w / h
      let sx = 0, sy = 0, sw = v.videoWidth, sh = v.videoHeight
      if (va > ca) { sw = sh * ca; sx = (v.videoWidth - sw) / 2 }
      else { sh = sw / ca; sy = (v.videoHeight - sh) / 2 }
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h)
      ctx.fillStyle = 'rgba(4,4,18,0.5)'
      ctx.fillRect(0, 0, w, h)
    } else if (bgImageEl) {
      const ia = bgImageEl.naturalWidth / bgImageEl.naturalHeight
      const ca = w / h
      let sx = 0, sy = 0, sw = bgImageEl.naturalWidth, sh = bgImageEl.naturalHeight
      if (ia > ca) { sw = sh * ca; sx = (bgImageEl.naturalWidth - sw) / 2 }
      else { sh = sw / ca; sy = (bgImageEl.naturalHeight - sh) / 2 }
      ctx.drawImage(bgImageEl, sx, sy, sw, sh, 0, 0, w, h)
      ctx.fillStyle = 'rgba(4,4,18,0.58)'
      ctx.fillRect(0, 0, w, h)
    } else if (bgPreset !== 'none') {
      drawBgPreset(ctx, bgPreset, t)
      if (defaultDark) { ctx.fillStyle = 'rgba(4,4,18,0.52)'; ctx.fillRect(0, 0, w, h) }
    } else if (defaultDark) {
      // Original psych dark bg
      const bg = ctx.createLinearGradient(0, 0, w, h)
      bg.addColorStop(0, '#08081e'); bg.addColorStop(1, '#1a0535')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
      const pr = 0.48 + Math.sin(t * 1.8) * 0.07
      const glow = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * pr)
      glow.addColorStop(0, 'rgba(120,60,255,0.2)'); glow.addColorStop(0.6, 'rgba(60,20,180,0.07)'); glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h)
    }
  }, [bgPreset, bgImageEl, seedanceVideoEl])

  // ── Psych template UI ───────────────────────────────────────────────────────

  const drawPsychFrame = useCallback((ctx: CanvasRenderingContext2D, t: number, num: string, withChar: boolean) => {
    const w = CANVAS_W, h = CANVAS_H
    const norm = t / config.duration
    drawBg(ctx, t, true)

    // Neural network (on dark bgs only, not over video/image)
    const useDarkNeural = !seedanceVideoEl && !bgImageEl && (bgPreset === 'none' || bgPreset === 'space' || bgPreset === 'neon')
    if (useDarkNeural) {
      ctx.save(); ctx.globalAlpha = 0.2
      const nodes: [number, number][] = [[0.12,0.18],[0.88,0.14],[0.08,0.52],[0.92,0.48],[0.18,0.82],[0.82,0.78],[0.5,0.1],[0.5,0.9],[0.3,0.35],[0.72,0.38]]
      for (const [nx, ny] of nodes) {
        const px = nx * w + Math.sin(t * 0.38 + nx * 5) * 10
        const py = ny * h + Math.cos(t * 0.28 + ny * 5) * 10
        for (const [nx2, ny2] of nodes) {
          const px2 = nx2 * w + Math.sin(t * 0.38 + nx2 * 5) * 10
          const py2 = ny2 * h + Math.cos(t * 0.28 + ny2 * 5) * 10
          const dist = Math.hypot(px2 - px, py2 - py)
          if (dist < 255 && dist > 0) { ctx.strokeStyle = `rgba(160,100,255,${(1 - dist / 255) * 0.32})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px2, py2); ctx.stroke() }
        }
        ctx.fillStyle = 'rgba(190,140,255,0.9)'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }

    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, w, 70)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('おすすめ', w / 2, 43)

    // Brain badge
    const bp = easeOut(norm, 0.0, 0.18)
    ctx.save(); ctx.globalAlpha = bp
    const bw = 290, bh = 52, bx = (w - bw) / 2, by = 92
    roundRect(ctx, bx, by, bw, bh, 26)
    const bbg = ctx.createLinearGradient(bx, by, bx + bw, by); bbg.addColorStop(0, '#7c3aed'); bbg.addColorStop(1, '#3b82f6')
    ctx.fillStyle = bbg; ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧠  心理学豆知識', w / 2, by + 34); ctx.restore()

    // Number + divider
    ctx.save(); ctx.globalAlpha = easeOut(norm, 0.08, 0.28) * 0.6
    ctx.fillStyle = '#a78bff'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(num, w / 2, 192); ctx.restore()

    const lp = easeOut(norm, 0.1, 0.3)
    ctx.save(); ctx.globalAlpha = lp * 0.45
    const lw = lp * 185; const lg = ctx.createLinearGradient(w / 2 - lw, 0, w / 2 + lw, 0)
    lg.addColorStop(0, 'transparent'); lg.addColorStop(0.5, '#a78bff'); lg.addColorStop(1, 'transparent')
    ctx.strokeStyle = lg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w / 2 - lw, 210); ctx.lineTo(w / 2 + lw, 210); ctx.stroke(); ctx.restore()

    // Title
    const tp = easeOut(norm, 0.13, 0.42)
    ctx.save(); ctx.globalAlpha = tp; ctx.shadowColor = 'rgba(160,100,255,0.9)'; ctx.shadowBlur = 22
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'
    wrapText(ctx, config.title, w / 2, h * 0.345 - (1 - tp) * 32, w - 80, 78); ctx.restore()

    // Subtitle card
    const sp = easeOut(norm, 0.42, 0.7)
    ctx.save(); ctx.globalAlpha = sp
    const cardY = h * 0.535, cardH = 205
    roundRect(ctx, 38, cardY, w - 76, cardH, 20); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()
    roundRect(ctx, 38, cardY, w - 76, cardH, 20); ctx.strokeStyle = 'rgba(160,100,255,0.28)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = 'rgba(225,210,255,0.9)'; ctx.font = '27px sans-serif'; ctx.textAlign = 'center'
    wrapText(ctx, config.subtitle, w / 2, cardY + 42, w - 118, 38); ctx.restore()

    // Character
    if (withChar) {
      const cp = easeOut(norm, 0.35, 0.55)
      const isTalking = sp > 0.08 && sp < 0.96
      const mouthOpen = isTalking ? Math.abs(Math.sin(t * 14.5)) * 0.72 : 0
      const blinking = Math.sin(t * 2.2 + 1.3) > 0.96
      ctx.save(); ctx.globalAlpha = cp
      ctx.translate(CANVAS_W / 2, h * 0.81); ctx.scale(cp, cp); ctx.translate(-CANVAS_W / 2, -h * 0.81)
      drawCharacter(ctx, CANVAS_W / 2, h * 0.81, 58, mouthOpen, blinking)
      if (isTalking && sp > 0.15) {
        const ba = Math.min(1, (sp - 0.15) / 0.2) * (1 - Math.max(0, (sp - 0.85) / 0.15))
        ctx.globalAlpha = cp * ba
        const bbx = CANVAS_W / 2 + 58 * 1.2, bby = h * 0.81 - 58 * 0.6
        roundRect(ctx, bbx, bby - 24, 145, 48, 14); ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.fill()
        ctx.beginPath(); ctx.moveTo(bbx, bby); ctx.lineTo(bbx - 14, bby + 10); ctx.lineTo(bbx - 14, bby - 10); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#5b21b6'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('なるほど！', bbx + 72, bby + 8)
      }
      ctx.restore()
    }

    // TikTok buttons
    const bbp = easeOut(norm, 0.32, 0.58)
    ctx.save(); ctx.globalAlpha = bbp * 0.85
    for (const [icon, label, fy] of [['♥','9.4k',0.5],['💬','312',0.61],['↗','シェア',0.72]] as [string,string,number][]) {
      ctx.font = '36px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(icon, w - 44, h * fy)
      ctx.font = 'bold 16px sans-serif'; ctx.fillText(label, w - 44, h * fy + 24)
    }
    ctx.restore()

    // Hashtag bar
    const hbp = easeOut(norm, 0.76, 0.94)
    ctx.save(); ctx.globalAlpha = hbp
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, h - 110, w, 110)
    ctx.fillStyle = '#c4b5fd'; ctx.font = 'bold 23px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(config.hashtags, w / 2, h - 40)
    ctx.restore()
  }, [config, drawBg, bgPreset, bgImageEl, seedanceVideoEl])

  // ── General templates UI ────────────────────────────────────────────────────

  const drawGeneralFrame = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    const w = CANVAS_W, h = CANVAS_H
    const norm = t / config.duration
    const hasBgOverride = !!seedanceVideoEl || !!bgImageEl || bgPreset !== 'none'

    if (hasBgOverride) {
      drawBg(ctx, t, false)
    } else if (config.template === 'dark') {
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h)
      const gw = ctx.createRadialGradient(w/2,h*0.4,0,w/2,h*0.4,h*0.55)
      gw.addColorStop(0, `${config.bgColor1}55`); gw.addColorStop(1, 'transparent')
      ctx.fillStyle = gw; ctx.fillRect(0, 0, w, h)
    } else if (config.template === 'minimal') {
      ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = config.bgColor1; ctx.fillRect(0, 0, w, 8)
    } else {
      const gg = ctx.createLinearGradient(0, 0, w, h)
      gg.addColorStop(0, config.bgColor1); gg.addColorStop(1, config.bgColor2)
      ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h)
    }

    if (config.template !== 'minimal' && !hasBgOverride) {
      ctx.save(); ctx.globalAlpha = 0.1
      for (let i = 0; i < 5; i++) {
        const px = (Math.sin(t*0.35+i*1.3)*0.4+0.5)*w; const py = (Math.cos(t*0.25+i*1.1)*0.4+0.5)*h; const pr2 = 50+i*30
        const rg = ctx.createRadialGradient(px,py,0,px,py,pr2); rg.addColorStop(0,'#ffffff'); rg.addColorStop(1,'transparent')
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px,py,pr2,0,Math.PI*2); ctx.fill()
      }
      ctx.restore()
    }

    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, w, 72)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('おすすめ', w/2, 46)

    const tp = easeOut(norm, 0.1, 0.4)
    const titleColor = config.template === 'minimal' && !hasBgOverride ? '#111' : config.textColor
    ctx.save(); ctx.globalAlpha = tp
    ctx.shadowColor = (config.template === 'minimal' && !hasBgOverride) ? 'transparent' : 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10
    ctx.fillStyle = titleColor; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center'
    wrapText(ctx, config.title, w/2, h*0.38-(1-tp)*40, w-80, 68); ctx.restore()

    const sp = easeOut(norm, 0.42, 0.68)
    ctx.save(); ctx.globalAlpha = sp
    ctx.fillStyle = (config.template === 'minimal' && !hasBgOverride) ? '#444' : `${config.textColor}cc`
    ctx.font = '30px sans-serif'; ctx.textAlign = 'center'
    wrapText(ctx, config.subtitle, w/2, h*0.56, w-100, 40); ctx.restore()

    const bbp = easeOut(norm, 0.3, 0.6)
    ctx.save(); ctx.globalAlpha = bbp * 0.9
    for (const [icon,label,fy] of [['♥','12.3k',0.52],['💬','423',0.63],['↗','シェア',0.74]] as [string,string,number][]) {
      ctx.font = '38px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(icon, w-42, h*fy)
      ctx.font = 'bold 18px sans-serif'; ctx.fillText(label, w-42, h*fy+28)
    }
    ctx.restore()

    const hbp = easeOut(norm, 0.72, 0.92)
    ctx.save(); ctx.globalAlpha = hbp
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, h-120, w, 120)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(config.hashtags, w/2, h-48)
    ctx.restore()
  }, [config, drawBg, bgPreset, bgImageEl, seedanceVideoEl])

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, t: number) => {
    // Output canvas is 1080x1920; render with 540x960 logical coords scaled 2x
    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    if (config.template === 'psych') drawPsychFrame(ctx, t, psychNum, showCharacter)
    else drawGeneralFrame(ctx, t)
  }, [config.template, drawPsychFrame, drawGeneralFrame, psychNum, showCharacter])

  const drawFrameOffline = useCallback(async (ctx: CanvasRenderingContext2D, t: number) => {
    const v = seedanceVideoEl
    if (v && v.duration > 0 && Number.isFinite(v.duration)) {
      const target = t % v.duration
      if (Math.abs(v.currentTime - target) > 0.05) {
        await new Promise<void>((resolve) => {
          const handler = () => { v.removeEventListener('seeked', handler); resolve() }
          v.addEventListener('seeked', handler)
          v.currentTime = target
          setTimeout(() => { v.removeEventListener('seeked', handler); resolve() }, 500)
        })
      }
    }
    drawFrame(ctx, t)
  }, [drawFrame, seedanceVideoEl])

  // Keep latest draw function refs for use after async state updates
  const drawFnRef = useRef(drawFrame)
  const drawFnAsyncRef = useRef(drawFrameOffline)
  useEffect(() => {
    drawFnRef.current = drawFrame
    drawFnAsyncRef.current = drawFrameOffline
  }, [drawFrame, drawFrameOffline])

  // ── Preview loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (exportState === 'encoding') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    previewStartRef.current = null
    const loop = (ts: number) => {
      if (!previewStartRef.current) previewStartRef.current = ts
      drawFrame(ctx, ((ts - previewStartRef.current) / 1000) % config.duration)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [exportState, drawFrame, config.duration])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const runExport = async () => {
    const canvas = canvasRef.current
    if (!canvas || exportState === 'encoding') return
    cancelAnimationFrame(rafRef.current)
    speechSynthesis.cancel()
    setIsSpeaking(false)
    setExportState('encoding')
    setProgress(0)

    try {
      const { blob, ext } = await exportVideo(canvas, drawFnRef.current, drawFnAsyncRef.current, config.duration, setProgress)
      if (urlCleanupRef.current) URL.revokeObjectURL(urlCleanupRef.current)
      const url = URL.createObjectURL(blob)
      urlCleanupRef.current = url
      setGeneratedUrl(url)
      setGeneratedExt(ext)
      setExportState('done')
      setPreviewView('video')
      // Auto-download as well for convenience
      const a = document.createElement('a')
      a.href = url
      a.download = `tiktok_${config.title}_${Date.now()}.${ext}`
      a.click()
    } catch {
      setExportState('idle')
    } finally {
      previewStartRef.current = null
    }
  }

  const handleExport = () => runExport()

  const handleDownload = () => {
    if (!generatedUrl) return
    const a = document.createElement('a')
    a.href = generatedUrl
    a.download = `tiktok_${config.title}_${Date.now()}.${generatedExt}`
    a.click()
  }

  const handleVoicePreview = () => {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(`${config.title}。${config.subtitle}`)
    utt.lang = 'ja-JP'; utt.rate = 0.88; utt.pitch = 1.1
    setIsSpeaking(true)
    utt.onend = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    speechSynthesis.speak(utt)
  }

  const handleBgUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { setBgImageEl(img); setBgPreset('none'); setSeedanceVideoEl(null); URL.revokeObjectURL(url) }
    img.src = url
  }

  const handleGenerateSeedance = async () => {
    if (!seedanceApiKey.trim()) { setSeedanceError('fal.ai のAPIキーを入力してください'); return }
    if (!seedancePrompt.trim()) { setSeedanceError('プロンプトを入力してください'); return }
    setSeedanceError('')
    seedanceAbortRef.current?.abort()
    const ctrl = new AbortController()
    seedanceAbortRef.current = ctrl
    try {
      const url = await generateSeedanceVideo(
        seedanceApiKey,
        { prompt: seedancePrompt, aspect_ratio: '9:16', duration: seedanceDuration, resolution: seedanceResolution },
        setSeedanceStatus,
        ctrl.signal,
      )
      const video = await loadVideoElement(url)
      setSeedanceVideoEl(video)
      setBgImageEl(null)
      setBgPreset('none')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      setSeedanceError(msg)
      setSeedanceStatus(null)
    }
  }

  const handleCancelSeedance = () => {
    seedanceAbortRef.current?.abort()
    setSeedanceStatus(null)
  }

  const handleClearSeedance = () => {
    seedanceVideoEl?.pause()
    setSeedanceVideoEl(null)
    setSeedanceStatus(null)
    setSeedanceError('')
  }

  const handleOneTap = async () => {
    if (exportState === 'encoding') return
    // Cycle through cinematic backgrounds for variety
    const presets: BgPreset[] = ['cinema_city', 'warp', 'aurora', 'space', 'sakura', 'forest', 'neon']
    const stored = Number(localStorage.getItem('onetap_index') ?? '0')
    const next = (stored + 1) % presets.length
    localStorage.setItem('onetap_index', String(next))
    const pick = presets[next]

    // Clear other backgrounds, set the picked preset
    if (seedanceVideoEl) {
      seedanceVideoEl.pause()
      setSeedanceVideoEl(null)
      setSeedanceStatus(null)
    }
    setBgImageEl(null)
    setBgPreset(pick)

    // If no preset selected (psych default), pick one for visual variety; otherwise cycle a fresh fact too
    if (config.template === 'psych') {
      const factIndex = (Number(localStorage.getItem('onetap_fact') ?? '-1') + 1) % PSYCH_FACTS.length
      localStorage.setItem('onetap_fact', String(factIndex))
      const fact = PSYCH_FACTS[factIndex]
      setPsychNum(fact.number)
      setConfig(prev => ({
        ...prev,
        title: fact.title,
        subtitle: fact.subtitle,
        hashtags: '#心理学 #豆知識 #雑学 #tiktok #psychology',
      }))
    }

    // Wait for state to propagate to draw fn refs
    await new Promise(r => setTimeout(r, 250))
    await runExport()
  }

  const handleFullAuto = async () => {
    if (!seedanceApiKey.trim()) {
      setSeedanceError('まず fal.ai のAPIキーを入力してください')
      return
    }
    setSeedanceError('')

    const promptMap: Record<string, string> = {
      '返報性の原理': 'two hands gently exchanging a wrapped gift, warm cinematic sunset lighting, slow motion, vertical 9:16',
      'バンドワゴン効果': 'large crowd of people walking together in a busy modern city street, dynamic motion blur, vertical 9:16',
      'アンカリング効果': 'glowing numbers and price tags floating in dark space, ethereal blue light, abstract cinematic',
      'カリギュラ効果': 'mysterious wooden door slightly ajar with red light leaking out, dramatic atmosphere, cinematic',
      'ハロー効果': 'silhouette of a person with bright golden halo behind them, ethereal soft glow, cinematic',
      '吊り橋効果': 'long swaying suspension bridge over misty deep canyon, dramatic vertical depth, cinematic',
      '認知的不協和': 'cracked mirror showing two contrasting reflections, artistic abstract scene, cinematic',
      'ツァイガルニク効果': 'unfinished jigsaw puzzle on a wooden desk, warm lamp light, mysterious atmosphere',
      'ピーク・エンドの法則': 'spectacular fireworks finale lighting up the night sky, vivid celebration, cinematic',
      'フット・イン・ザ・ドア': 'wooden front door slowly opening with warm golden light spilling out, inviting cinematic',
    }
    const prompt = promptMap[config.title] ?? `cinematic atmospheric vertical scene representing the concept "${config.title}", soft lighting, 9:16`
    setSeedancePrompt(prompt)

    try {
      const ctrl = new AbortController()
      seedanceAbortRef.current = ctrl
      const url = await generateSeedanceVideo(
        seedanceApiKey,
        { prompt, aspect_ratio: '9:16', duration: '5', resolution: '720p' },
        setSeedanceStatus,
        ctrl.signal,
      )
      const video = await loadVideoElement(url)
      setBgImageEl(null)
      setBgPreset('none')
      setSeedanceVideoEl(video)

      // Wait for state propagation + draw fn refs to update
      await new Promise((r) => setTimeout(r, 350))

      // Now run the full export with up-to-date draw functions
      await runExport()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      setSeedanceError(msg)
      setSeedanceStatus(null)
    }
  }

  const update = <K extends keyof VideoConfig>(key: K, value: VideoConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }))

  const applyPreset = (fact: PsychFact) => {
    setPsychNum(fact.number)
    setConfig(prev => ({ ...prev, title: fact.title, subtitle: fact.subtitle, template: 'psych', hashtags: '#心理学 #豆知識 #雑学 #tiktok #psychology' }))
  }

  const isPsych = config.template === 'psych'

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="tiktok-creator">
      <div className="creator-layout">
        {/* ── Settings ── */}
        <div className="creator-form">
          {/* ONE-TAP MODE — no setup, no API key required */}
          <div className="onetap-panel">
            <button
              className="onetap-btn"
              onClick={handleOneTap}
              disabled={exportState === 'encoding'}
            >
              {exportState === 'encoding'
                ? `🎬 作成中... ${progress}%`
                : '✨ ワンタップでMP4作成（設定なし・無料・全自動）'}
            </button>
            <p className="onetap-hint">
              押すたびに違う心理学ネタ ＋ 違う背景で MP4 が自動で生成・ダウンロードされます。
            </p>
          </div>

          <h2 className="form-title">詳細設定（必要なら）</h2>

          <div className="form-group">
            <label>テンプレート</label>
            <div className="template-buttons">
              {(['psych','gradient','dark','minimal'] as const).map(t => (
                <button key={t} className={`template-btn${config.template===t?' active':''}`} onClick={() => update('template',t)}>
                  {t==='psych'?'🧠 心理学':t==='gradient'?'グラデ':t==='dark'?'ダーク':'ミニマル'}
                </button>
              ))}
            </div>
          </div>

          {isPsych && (
            <div className="form-group">
              <label>プリセット（クリックで即反映）</label>
              <div className="preset-grid">
                {PSYCH_FACTS.map(fact => (
                  <button key={fact.number} className={`preset-btn${config.title===fact.title?' active':''}`} onClick={() => applyPreset(fact)}>
                    <span className="preset-num">{fact.number}</span>
                    <span className="preset-name">{fact.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>背景</label>
            <div className="bg-presets">
              {([['none','デフォルト','#08081e'],['cinema_city','🌃 夜景','#1a0533'],['warp','🚀 ワープ','#000007'],['aurora','🌌 オーロラ','#020812'],['space','✨ 宇宙','#040412'],['sakura','🌸 桜','#ffe0e8'],['neon','⚡ ネオン','#03030a'],['forest','🌿 森','#061408']] as [BgPreset,string,string][]).map(([val,label,color]) => (
                <button key={val} className={`bg-preset-btn${bgPreset===val&&!bgImageEl&&!seedanceVideoEl?' active':''}`}
                  style={{ '--bg-color': color } as React.CSSProperties}
                  onClick={() => { setBgPreset(val); setBgImageEl(null); handleClearSeedance() }}>
                  {label}
                </button>
              ))}
              <button className={`bg-preset-btn upload-btn${bgImageEl?' active':''}`} onClick={() => fileInputRef.current?.click()}>
                📁 自分の画像
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleBgUpload} />
            {bgImageEl && <p className="bg-img-label">画像設定済み <button onClick={() => setBgImageEl(null)}>✕ 削除</button></p>}
          </div>

          {/* Seedance AI Background */}
          <div className="seedance-panel">
            <h3 className="seedance-title">🎨 AI動画背景 <span className="seedance-sub">Seedance / fal.ai</span></h3>

            {seedanceVideoEl ? (
              <div className="seedance-active">
                <p className="seedance-active-msg">✓ AI動画を背景に適用中</p>
                <button className="seedance-clear-btn" onClick={handleClearSeedance}>✕ 削除して通常背景に戻す</button>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>fal.ai APIキー</label>
                  <input
                    type="password"
                    value={seedanceApiKey}
                    onChange={e => setSeedanceApiKey(e.target.value)}
                    placeholder="********-****-****-****-************:****"
                    autoComplete="off"
                  />
                  <p className="seedance-help">
                    <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer">fal.ai/dashboard/keys</a> から取得（無料クレジット付与）
                  </p>
                </div>

                <div className="form-group">
                  <label>動画プロンプト（英語推奨だが日本語もOK）</label>
                  <textarea
                    value={seedancePrompt}
                    onChange={e => setSeedancePrompt(e.target.value)}
                    rows={3}
                    placeholder="例: cinematic shot of neon-lit Shibuya street at night, rain"
                  />
                </div>

                <div className="seedance-options">
                  <div className="seedance-option-group">
                    <label>長さ</label>
                    <div className="template-buttons">
                      {(['5','10'] as const).map(d => (
                        <button key={d} className={`template-btn${seedanceDuration===d?' active':''}`} onClick={() => setSeedanceDuration(d)}>{d}秒</button>
                      ))}
                    </div>
                  </div>
                  <div className="seedance-option-group">
                    <label>解像度</label>
                    <div className="template-buttons">
                      {(['480p','720p','1080p'] as const).map(r => (
                        <button key={r} className={`template-btn${seedanceResolution===r?' active':''}`} onClick={() => setSeedanceResolution(r)}>{r}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {seedanceStatus && (seedanceStatus.status === 'submitting' || seedanceStatus.status === 'queued' || seedanceStatus.status === 'in_progress') ? (
                  <button className="seedance-cancel-btn" onClick={handleCancelSeedance}>{seedanceStatus.message} (キャンセル)</button>
                ) : (
                  <>
                    <button
                      className="seedance-auto-btn"
                      onClick={handleFullAuto}
                      disabled={!seedanceApiKey.trim() || exportState === 'encoding'}
                    >
                      🚀  全自動でMP4を作成（プロンプト→AI動画→合成→MP4まで）
                    </button>
                    <button className="seedance-gen-btn" onClick={handleGenerateSeedance} disabled={!seedanceApiKey.trim() || !seedancePrompt.trim()}>
                      🎨  AI動画だけ生成（背景に適用）
                    </button>
                  </>
                )}

                {seedanceError && <p className="seedance-error">⚠ {seedanceError}</p>}
              </>
            )}
          </div>

          <div className="form-group">
            <label>{isPsych?'原理・法則名（大見出し）':'タイトル'}</label>
            <textarea value={config.title} onChange={e => update('title',e.target.value)} rows={2} placeholder={isPsych?'例：返報性の原理':'大きく表示されるタイトル'} />
          </div>
          <div className="form-group">
            <label>{isPsych?'説明文':'サブテキスト'}</label>
            <textarea value={config.subtitle} onChange={e => update('subtitle',e.target.value)} rows={4} placeholder="内容を入力してください" />
          </div>
          <div className="form-group">
            <label>ハッシュタグ</label>
            <input type="text" value={config.hashtags} onChange={e => update('hashtags',e.target.value)} />
          </div>

          {!isPsych && (
            <div className="form-row">
              <div className="form-group"><label>カラー1</label><input type="color" value={config.bgColor1} onChange={e => update('bgColor1',e.target.value)} /></div>
              <div className="form-group"><label>カラー2</label><input type="color" value={config.bgColor2} onChange={e => update('bgColor2',e.target.value)} /></div>
              <div className="form-group"><label>文字色</label><input type="color" value={config.textColor} onChange={e => update('textColor',e.target.value)} /></div>
            </div>
          )}

          {isPsych && (
            <div className="form-group">
              <label>キャラクター</label>
              <div className="template-buttons">
                <button className={`template-btn${showCharacter?' active':''}`} onClick={() => setShowCharacter(true)}>表示</button>
                <button className={`template-btn${!showCharacter?' active':''}`} onClick={() => setShowCharacter(false)}>非表示</button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>動画の長さ: {config.duration}秒</label>
            <input type="range" min={8} max={30} value={config.duration} onChange={e => update('duration',Number(e.target.value))} />
          </div>

          <button className={`voice-btn${isSpeaking?' speaking':''}`} onClick={isSpeaking?()=>{speechSynthesis.cancel();setIsSpeaking(false)}:handleVoicePreview} disabled={exportState==='encoding'}>
            {isSpeaking?'■  しゃべりを止める':'▶  声でプレビュー（日本語TTS）'}
          </button>

          <button className={`record-btn${exportState==='encoding'?' recording':''}`} onClick={handleExport} disabled={exportState==='encoding'}>
            {exportState==='encoding'?`MP4生成中... ${progress}%`:'🎬  MP4動画を生成'}
          </button>

          {exportState==='encoding' && (
            <div className="progress-bar"><div className="progress-fill" style={{ width:`${progress}%` }} /></div>
          )}
          {exportState==='done' && (
            <p className="success-msg">生成完了！（{generatedExt.toUpperCase()}）右のプレビューで確認してください。</p>
          )}

          <div className="upload-guide">
            <h3>使い方</h3>
            <ol>
              <li>設定を調整してライブプレビューを確認</li>
              <li>「MP4動画を生成」ボタンを押す（Chrome推奨）</li>
              <li>右の「完成動画」タブで再生確認</li>
              <li>「ダウンロード」→ TikTokアプリでアップロード</li>
            </ol>
          </div>
        </div>

        {/* ── Preview ── */}
        <div className="creator-preview">
          <div className="preview-header">
            <p className="preview-label">プレビュー</p>
            {generatedUrl && (
              <div className="preview-tabs">
                <button className={`preview-tab${previewView==='canvas'?' active':''}`} onClick={() => setPreviewView('canvas')}>ライブ</button>
                <button className={`preview-tab${previewView==='video'?' active':''}`} onClick={() => setPreviewView('video')}>完成動画</button>
              </div>
            )}
          </div>

          <div className={`canvas-wrapper${previewView==='video'?' hidden':''}`}>
            <canvas ref={canvasRef} width={OUTPUT_W} height={OUTPUT_H} />
          </div>

          {previewView==='video' && generatedUrl && (
            <div className="video-wrapper">
              <video src={generatedUrl} controls autoPlay loop playsInline />
            </div>
          )}

          <p className="canvas-size">540 × 960 (9:16)</p>

          {generatedUrl && (
            <button className="download-btn" onClick={handleDownload}>
              ⬇ ダウンロード（{generatedExt.toUpperCase()}）
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
