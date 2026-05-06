import { useState, useRef, useEffect, useCallback } from 'react'

type Template = 'gradient' | 'dark' | 'minimal' | 'psych'

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

const PSYCH_FACTS: PsychFact[] = [
  {
    number: 'No.1',
    title: '返報性の原理',
    subtitle:
      '何かをしてもらうと「お返しをしなければ」という気持ちになる心理。セールスや恋愛でもよく使われます。',
  },
  {
    number: 'No.2',
    title: 'バンドワゴン効果',
    subtitle:
      '「みんながやっているから自分も」と思う心理。SNSのトレンドや流行語もこの効果で広まります。',
  },
  {
    number: 'No.3',
    title: 'アンカリング効果',
    subtitle:
      '最初に見た数字や情報が基準になってしまう心理。「元値10,000円→今なら3,000円」が効く理由です。',
  },
  {
    number: 'No.4',
    title: 'カリギュラ効果',
    subtitle:
      '「見てはいけない」と言われるほど気になる心理。禁止されると欲求が高まるのはこのためです。',
  },
  {
    number: 'No.5',
    title: 'ハロー効果',
    subtitle:
      '外見が良い人は仕事もできると思い込む心理。一つの特徴が全体の評価に影響してしまいます。',
  },
  {
    number: 'No.6',
    title: '吊り橋効果',
    subtitle:
      'ドキドキする状況で一緒にいる人に恋愛感情を抱きやすくなる心理。不安が恋と混同されます。',
  },
  {
    number: 'No.7',
    title: '認知的不協和',
    subtitle:
      '自分の行動と考えが矛盾するとき、無意識に考えを変えて矛盾をなくそうとする心理のしくみです。',
  },
  {
    number: 'No.8',
    title: 'ツァイガルニク効果',
    subtitle:
      '完了より未完了の方が記憶に残りやすい心理。ドラマの「続きは次回！」はこれを利用しています。',
  },
  {
    number: 'No.9',
    title: 'ピーク・エンドの法則',
    subtitle:
      '体験の評価は「最も感情が動いた瞬間」と「終わり方」で決まります。終わりよければすべてよし。',
  },
  {
    number: 'No.10',
    title: 'フット・イン・ザ・ドア',
    subtitle:
      '小さなお願いを先に承諾してもらうと、次の大きなお願いも通りやすくなる段階的説得法です。',
  },
]

const CANVAS_W = 540
const CANVAS_H = 960
const FPS = 30

function easeOut(progress: number, start: number, end: number): number {
  const t = Math.min(1, Math.max(0, (progress - start) / (end - start)))
  return 1 - Math.pow(1 - t, 3)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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

// Cute anime-style character
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  mouthOpen: number,
  blinking: boolean,
) {
  // Body
  const bodyGrad = ctx.createLinearGradient(cx - r * 0.6, cy + r, cx + r * 0.6, cy + r * 2.4)
  bodyGrad.addColorStop(0, '#6d28d9')
  bodyGrad.addColorStop(1, '#4c1d95')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 1.7, r * 0.68, r * 0.88, 0, 0, Math.PI * 2)
  ctx.fill()

  // Collar
  ctx.fillStyle = '#ddd6fe'
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 0.95, r * 0.32, r * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Head shadow
  ctx.save()
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(cx + 5, cy + 5, r, r, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Head
  const headGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r)
  headGrad.addColorStop(0, '#ffe0b2')
  headGrad.addColorStop(1, '#ffcc80')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Hair base (covers top half of head)
  ctx.fillStyle = '#4c1d95'
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.95)
  ctx.lineTo(cx, cy)
  ctx.closePath()
  ctx.fill()

  // Hair tufts
  const tufts: [number, number, number][] = [
    [-0.55, -0.78, 0.3],
    [-0.12, -0.98, 0.34],
    [0.32, -0.9, 0.28],
    [0.65, -0.68, 0.24],
  ]
  for (const [dx, dy, sz] of tufts) {
    ctx.fillStyle = '#5b21b6'
    ctx.beginPath()
    ctx.arc(cx + dx * r, cy + dy * r, sz * r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ear left
  ctx.fillStyle = '#ffcc80'
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.92, cy + r * 0.05, r * 0.22, r * 0.28, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffb74d'
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.92, cy + r * 0.05, r * 0.13, r * 0.17, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // Ear right
  ctx.fillStyle = '#ffcc80'
  ctx.beginPath()
  ctx.ellipse(cx + r * 0.92, cy + r * 0.05, r * 0.22, r * 0.28, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffb74d'
  ctx.beginPath()
  ctx.ellipse(cx + r * 0.92, cy + r * 0.05, r * 0.13, r * 0.17, 0.3, 0, Math.PI * 2)
  ctx.fill()

  const eyeY = cy - r * 0.08
  const eyeX = r * 0.32

  if (blinking) {
    // Closed eyes (happy curve)
    ctx.strokeStyle = '#4a2800'
    ctx.lineWidth = r * 0.09
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx - eyeX, eyeY + r * 0.06, r * 0.16, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + eyeX, eyeY + r * 0.06, r * 0.16, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
  } else {
    // White of eyes
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(cx - eyeX, eyeY, r * 0.21, r * 0.26, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + eyeX, eyeY, r * 0.21, r * 0.26, 0, 0, Math.PI * 2)
    ctx.fill()

    // Iris
    ctx.fillStyle = '#6d28d9'
    ctx.beginPath()
    ctx.ellipse(cx - eyeX + r * 0.02, eyeY + r * 0.02, r * 0.13, r * 0.17, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + eyeX + r * 0.02, eyeY + r * 0.02, r * 0.13, r * 0.17, 0, 0, Math.PI * 2)
    ctx.fill()

    // Pupil
    ctx.fillStyle = '#1a0a2e'
    ctx.beginPath()
    ctx.ellipse(cx - eyeX + r * 0.02, eyeY + r * 0.02, r * 0.07, r * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + eyeX + r * 0.02, eyeY + r * 0.02, r * 0.07, r * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()

    // Shine dots
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - eyeX + r * 0.07, eyeY - r * 0.07, r * 0.055, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + eyeX + r * 0.07, eyeY - r * 0.07, r * 0.055, 0, Math.PI * 2)
    ctx.fill()

    // Eyelashes top
    ctx.strokeStyle = '#4a2800'
    ctx.lineWidth = r * 0.06
    ctx.lineCap = 'round'
    for (const [side, lx] of [[-1, cx - eyeX], [1, cx + eyeX]] as [number, number][]) {
      ctx.beginPath()
      ctx.moveTo(lx - r * 0.13, eyeY - r * 0.22)
      ctx.lineTo(lx - r * 0.18 * side, eyeY - r * 0.3)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(lx + r * 0.13, eyeY - r * 0.22)
      ctx.lineTo(lx + r * 0.18 * side, eyeY - r * 0.3)
      ctx.stroke()
    }
  }

  // Eyebrows
  ctx.strokeStyle = '#4a2800'
  ctx.lineWidth = r * 0.07
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - eyeX - r * 0.17, eyeY - r * 0.36)
  ctx.quadraticCurveTo(cx - eyeX, eyeY - r * 0.44, cx - eyeX + r * 0.17, eyeY - r * 0.36)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + eyeX - r * 0.17, eyeY - r * 0.36)
  ctx.quadraticCurveTo(cx + eyeX, eyeY - r * 0.44, cx + eyeX + r * 0.17, eyeY - r * 0.36)
  ctx.stroke()

  // Blush
  ctx.save()
  ctx.globalAlpha = 0.38
  ctx.fillStyle = '#ff7096'
  ctx.beginPath()
  ctx.ellipse(cx - eyeX * 1.75, eyeY + r * 0.35, r * 0.25, r * 0.13, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + eyeX * 1.75, eyeY + r * 0.35, r * 0.25, r * 0.13, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Mouth
  const mouthY = cy + r * 0.45
  const mouthW = r * 0.36

  if (mouthOpen < 0.05) {
    // Smile
    ctx.strokeStyle = '#bf5050'
    ctx.lineWidth = r * 0.07
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, mouthY + r * 0.05, mouthW * 0.75, 0.15, Math.PI - 0.15)
    ctx.stroke()
  } else {
    const openH = mouthOpen * r * 0.34
    // Outer mouth
    ctx.fillStyle = '#bf2020'
    ctx.beginPath()
    ctx.ellipse(cx, mouthY, mouthW, openH, 0, 0, Math.PI * 2)
    ctx.fill()
    // Teeth
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(cx, mouthY - openH * 0.15, mouthW * 0.75, openH * 0.45, 0, 0, Math.PI)
    ctx.fill()
    // Tongue
    ctx.fillStyle = '#ff8080'
    ctx.beginPath()
    ctx.ellipse(cx, mouthY + openH * 0.2, mouthW * 0.45, openH * 0.38, 0, 0, Math.PI)
    ctx.fill()
  }

  // Nose (tiny dots)
  ctx.fillStyle = '#cc8844'
  ctx.beginPath()
  ctx.arc(cx - r * 0.07, cy + r * 0.22, r * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + r * 0.07, cy + r * 0.22, r * 0.035, 0, Math.PI * 2)
  ctx.fill()
}

function setupAmbientAudio(
  audioCtx: AudioContext,
  dest: MediaStreamAudioDestinationNode,
  duration: number,
  talkStartRatio: number,
  talkEndRatio: number,
) {
  const now = audioCtx.currentTime

  // Ambient A-minor pad (very quiet)
  const ambientFreqs = [110, 130.81, 164.81, 220, 261.63]
  for (const freq of ambientFreqs) {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.018, now + 1.5)
    gain.gain.linearRampToValueAtTime(0.018, now + duration - 1.5)
    gain.gain.linearRampToValueAtTime(0, now + duration)
    osc.connect(gain)
    gain.connect(dest)
    osc.start(now)
    osc.stop(now + duration + 0.1)
  }

  // Talking voice-like sound (band-pass filtered noise pattern)
  const talkStart = duration * talkStartRatio
  const talkEnd = duration * talkEndRatio
  const talkDuration = talkEnd - talkStart

  const voiceFreqs = [180, 260, 320, 430]
  for (const freq of voiceFreqs) {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq + Math.random() * 20

    gain.gain.setValueAtTime(0, now)

    // Schedule rapid on-off bursts (simulates syllables)
    const syllableRate = 4.5
    const syllableCount = Math.floor(talkDuration * syllableRate)
    for (let i = 0; i < syllableCount; i++) {
      const t = now + talkStart + (i / syllableRate)
      const vol = 0.022 + Math.random() * 0.015
      gain.gain.setValueAtTime(vol, t)
      gain.gain.setValueAtTime(0, t + 0.08 + Math.random() * 0.04)
    }

    osc.connect(gain)
    gain.connect(dest)
    osc.start(now)
    osc.stop(now + duration + 0.1)
  }
}

export function TikTokCreator() {
  const [config, setConfig] = useState<VideoConfig>({
    title: '返報性の原理',
    subtitle:
      '何かをしてもらうと「お返しをしなければ」という気持ちになる心理。セールスや恋愛でもよく使われます。',
    hashtags: '#心理学 #豆知識 #雑学 #tiktok',
    bgColor1: '#ff0050',
    bgColor2: '#00f2ea',
    textColor: '#ffffff',
    duration: 12,
    template: 'psych',
  })
  const [psychNum, setPsychNum] = useState('No.1')
  const [showCharacter, setShowCharacter] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloaded, setDownloaded] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const previewStartRef = useRef<number | null>(null)

  const drawPsychFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number, num: string, withCharacter: boolean) => {
      const w = CANVAS_W
      const h = CANVAS_H
      const dur = config.duration
      const norm = t / dur

      // Background
      const bg = ctx.createLinearGradient(0, 0, w, h)
      bg.addColorStop(0, '#08081e')
      bg.addColorStop(1, '#1a0535')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Pulsing glow
      const pulseR = 0.48 + Math.sin(t * 1.8) * 0.07
      const glow = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, h * pulseR)
      glow.addColorStop(0, 'rgba(120,60,255,0.2)')
      glow.addColorStop(0.6, 'rgba(60,20,180,0.07)')
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // Neural-network nodes
      ctx.save()
      ctx.globalAlpha = 0.22
      const nodes: [number, number][] = [
        [0.12, 0.18], [0.88, 0.14], [0.08, 0.52], [0.92, 0.48],
        [0.18, 0.82], [0.82, 0.78], [0.5, 0.1], [0.5, 0.9],
        [0.3, 0.35], [0.72, 0.38],
      ]
      for (const [nx, ny] of nodes) {
        const px = nx * w + Math.sin(t * 0.38 + nx * 5) * 10
        const py = ny * h + Math.cos(t * 0.28 + ny * 5) * 10
        for (const [nx2, ny2] of nodes) {
          const px2 = nx2 * w + Math.sin(t * 0.38 + nx2 * 5) * 10
          const py2 = ny2 * h + Math.cos(t * 0.28 + ny2 * 5) * 10
          const dist = Math.hypot(px2 - px, py2 - py)
          if (dist < 260 && dist > 0) {
            ctx.strokeStyle = `rgba(160,100,255,${(1 - dist / 260) * 0.35})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(px, py)
            ctx.lineTo(px2, py2)
            ctx.stroke()
          }
        }
        ctx.fillStyle = 'rgba(190,140,255,0.9)'
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // Top bar
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      ctx.fillRect(0, 0, w, 70)
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.font = '22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('おすすめ', w / 2, 43)

      // Brain badge
      const badgeP = easeOut(norm, 0.0, 0.18)
      ctx.save()
      ctx.globalAlpha = badgeP
      const bw = 290, bh = 52, bx = (w - bw) / 2, by = 92
      roundRect(ctx, bx, by, bw, bh, 26)
      const badgeBg = ctx.createLinearGradient(bx, by, bx + bw, by)
      badgeBg.addColorStop(0, '#7c3aed')
      badgeBg.addColorStop(1, '#3b82f6')
      ctx.fillStyle = badgeBg
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🧠  心理学豆知識', w / 2, by + 34)
      ctx.restore()

      // Number
      ctx.save()
      ctx.globalAlpha = easeOut(norm, 0.08, 0.28) * 0.6
      ctx.fillStyle = '#a78bff'
      ctx.font = 'bold 30px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(num, w / 2, 192)
      ctx.restore()

      // Divider
      const lineP = easeOut(norm, 0.1, 0.3)
      ctx.save()
      ctx.globalAlpha = lineP * 0.45
      const lw = lineP * 190
      const lg = ctx.createLinearGradient(w / 2 - lw, 0, w / 2 + lw, 0)
      lg.addColorStop(0, 'transparent')
      lg.addColorStop(0.5, '#a78bff')
      lg.addColorStop(1, 'transparent')
      ctx.strokeStyle = lg
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(w / 2 - lw, 210)
      ctx.lineTo(w / 2 + lw, 210)
      ctx.stroke()
      ctx.restore()

      // Title (principle name)
      const tp = easeOut(norm, 0.13, 0.42)
      ctx.save()
      ctx.globalAlpha = tp
      ctx.shadowColor = 'rgba(160,100,255,0.9)'
      ctx.shadowBlur = 22
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold 64px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.title, w / 2, h * 0.345 - (1 - tp) * 32, w - 80, 78)
      ctx.restore()

      // Subtitle card
      const sp = easeOut(norm, 0.42, 0.7)
      ctx.save()
      ctx.globalAlpha = sp
      const cardY = h * 0.535, cardH = 205
      roundRect(ctx, 38, cardY, w - 76, cardH, 20)
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fill()
      roundRect(ctx, 38, cardY, w - 76, cardH, 20)
      ctx.strokeStyle = 'rgba(160,100,255,0.28)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = 'rgba(225,210,255,0.9)'
      ctx.font = `27px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.subtitle, w / 2, cardY + 42, w - 118, 38)
      ctx.restore()

      // Character (bottom center)
      if (withCharacter) {
        const charP = easeOut(norm, 0.35, 0.55)
        const charScale = charP
        const cx = w / 2
        const cy = h * 0.81
        const r = 58

        const isTalking = sp > 0.08 && sp < 0.96
        const mouthOpen = isTalking ? Math.abs(Math.sin(t * 14.5)) * 0.72 : 0
        const blinking = Math.sin(t * 2.2 + 1.3) > 0.96

        ctx.save()
        ctx.globalAlpha = charP
        ctx.translate(cx, cy)
        ctx.scale(charScale, charScale)
        ctx.translate(-cx, -cy)
        drawCharacter(ctx, cx, cy, r, mouthOpen, blinking)

        // Speech bubble (while talking)
        if (isTalking && sp > 0.15) {
          const bubbleAlpha = Math.min(1, (sp - 0.15) / 0.2) * (1 - Math.max(0, (sp - 0.85) / 0.15))
          ctx.globalAlpha = charP * bubbleAlpha
          const bx = cx + r * 1.2
          const bubby = cy - r * 0.6
          const bw2 = 140, bh2 = 48
          roundRect(ctx, bx, bubby - bh2 / 2, bw2, bh2, 14)
          ctx.fillStyle = 'rgba(255,255,255,0.92)'
          ctx.fill()
          // Tail
          ctx.beginPath()
          ctx.moveTo(bx, bubby)
          ctx.lineTo(bx - 14, bubby + 10)
          ctx.lineTo(bx - 14, bubby - 10)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#5b21b6'
          ctx.font = 'bold 22px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('なるほど！', bx + bw2 / 2, bubby + 8)
        }
        ctx.restore()
      }

      // TikTok action buttons
      const bp = easeOut(norm, 0.32, 0.58)
      ctx.save()
      ctx.globalAlpha = bp * 0.85
      const bx2 = w - 44
      const btns: [string, string, number][] = [
        ['♥', '9.4k', 0.5],
        ['💬', '312', 0.61],
        ['↗', 'シェア', 0.72],
      ]
      for (const [icon, label, fy] of btns) {
        ctx.font = '36px sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(icon, bx2, h * fy)
        ctx.font = 'bold 16px sans-serif'
        ctx.fillText(label, bx2, h * fy + 24)
      }
      ctx.restore()

      // Hashtag bar
      const hp = easeOut(norm, 0.76, 0.94)
      ctx.save()
      ctx.globalAlpha = hp
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, h - 110, w, 110)
      ctx.fillStyle = '#c4b5fd'
      ctx.font = 'bold 23px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(config.hashtags, w / 2, h - 40)
      ctx.restore()
    },
    [config],
  )

  const drawGeneralFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const w = CANVAS_W
      const h = CANVAS_H
      const norm = t / config.duration

      if (config.template === 'dark') {
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, w, h)
        const glow = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, h * 0.55)
        glow.addColorStop(0, `${config.bgColor1}55`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, w, h)
      } else if (config.template === 'minimal') {
        ctx.fillStyle = '#f5f5f5'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = config.bgColor1
        ctx.fillRect(0, 0, w, 8)
      } else {
        const grad = ctx.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, config.bgColor1)
        grad.addColorStop(1, config.bgColor2)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }

      if (config.template !== 'minimal') {
        ctx.save()
        ctx.globalAlpha = 0.1
        for (let i = 0; i < 5; i++) {
          const px = (Math.sin(t * 0.35 + i * 1.3) * 0.4 + 0.5) * w
          const py = (Math.cos(t * 0.25 + i * 1.1) * 0.4 + 0.5) * h
          const pr = 50 + i * 30
          const rg = ctx.createRadialGradient(px, py, 0, px, py, pr)
          rg.addColorStop(0, '#ffffff')
          rg.addColorStop(1, 'transparent')
          ctx.fillStyle = rg
          ctx.beginPath()
          ctx.arc(px, py, pr, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(0, 0, w, 72)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 26px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('おすすめ', w / 2, 46)

      const tp = easeOut(norm, 0.1, 0.4)
      ctx.save()
      ctx.globalAlpha = tp
      ctx.shadowColor = config.template === 'minimal' ? 'transparent' : 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 10
      ctx.fillStyle = config.template === 'minimal' ? '#111' : config.textColor
      ctx.font = `bold 56px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.title, w / 2, h * 0.38 - (1 - tp) * 40, w - 80, 68)
      ctx.restore()

      const sp = easeOut(norm, 0.42, 0.68)
      ctx.save()
      ctx.globalAlpha = sp
      ctx.fillStyle = config.template === 'minimal' ? '#444' : `${config.textColor}cc`
      ctx.font = `30px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.subtitle, w / 2, h * 0.56, w - 100, 40)
      ctx.restore()

      const bp = easeOut(norm, 0.3, 0.6)
      ctx.save()
      ctx.globalAlpha = bp * 0.9
      for (const [icon, label, fy] of [['♥', '12.3k', 0.52], ['💬', '423', 0.63], ['↗', 'シェア', 0.74]] as [string, string, number][]) {
        ctx.font = '38px sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(icon, w - 42, h * fy)
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText(label, w - 42, h * fy + 28)
      }
      ctx.restore()

      const hp = easeOut(norm, 0.72, 0.92)
      ctx.save()
      ctx.globalAlpha = hp
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, h - 120, w, 120)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 26px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(config.hashtags, w / 2, h - 48)
      ctx.restore()
    },
    [config],
  )

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      if (config.template === 'psych') {
        drawPsychFrame(ctx, t, psychNum, showCharacter)
      } else {
        drawGeneralFrame(ctx, t)
      }
    },
    [config.template, drawPsychFrame, drawGeneralFrame, psychNum, showCharacter],
  )

  useEffect(() => {
    if (isRecording) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    previewStartRef.current = null

    const loop = (ts: number) => {
      if (!previewStartRef.current) previewStartRef.current = ts
      const t = ((ts - previewStartRef.current) / 1000) % config.duration
      drawFrame(ctx, t)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isRecording, drawFrame, config.duration])

  const handleVoicePreview = () => {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(
      `${config.title}。${config.subtitle}`,
    )
    utterance.lang = 'ja-JP'
    utterance.rate = 0.88
    utterance.pitch = 1.1
    setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    speechSynthesis.speak(utterance)
  }

  const stopVoice = () => {
    speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  const startRecording = () => {
    const canvas = canvasRef.current
    if (!canvas || isRecording) return

    cancelAnimationFrame(rafRef.current)
    speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsRecording(true)
    setProgress(0)
    setDownloaded(false)

    const ctx = canvas.getContext('2d')!

    // Setup audio (ambient + talking sounds)
    const audioCtx = new AudioContext()
    const audioDest = audioCtx.createMediaStreamDestination()
    setupAmbientAudio(audioCtx, audioDest, config.duration, 0.42, 0.78)

    const videoStream = canvas.captureStream(FPS)
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ])

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'

    const recorder = new MediaRecorder(combinedStream, { mimeType })
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
      audioCtx.close()
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tiktok_${config.title}_${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      setIsRecording(false)
      setProgress(0)
      setDownloaded(true)
      previewStartRef.current = null
    }

    recorder.start()
    let recStart: number | null = null
    const recordLoop = (ts: number) => {
      if (!recStart) recStart = ts
      const t = (ts - recStart) / 1000
      if (t >= config.duration) {
        recorder.stop()
        return
      }
      drawFrame(ctx, t)
      setProgress(Math.round((t / config.duration) * 100))
      rafRef.current = requestAnimationFrame(recordLoop)
    }
    rafRef.current = requestAnimationFrame(recordLoop)
  }

  const update = <K extends keyof VideoConfig>(key: K, value: VideoConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }))

  const applyPreset = (fact: PsychFact) => {
    setPsychNum(fact.number)
    setConfig((prev) => ({
      ...prev,
      title: fact.title,
      subtitle: fact.subtitle,
      template: 'psych',
      hashtags: '#心理学 #豆知識 #雑学 #tiktok #psychology',
    }))
  }

  const isPsych = config.template === 'psych'

  return (
    <div className="tiktok-creator">
      <div className="creator-layout">
        <div className="creator-form">
          <h2 className="form-title">動画設定</h2>

          <div className="form-group">
            <label>テンプレート</label>
            <div className="template-buttons">
              {(['psych', 'gradient', 'dark', 'minimal'] as const).map((t) => (
                <button
                  key={t}
                  className={`template-btn${config.template === t ? ' active' : ''}`}
                  onClick={() => update('template', t)}
                >
                  {t === 'psych' ? '🧠 心理学' : t === 'gradient' ? 'グラデ' : t === 'dark' ? 'ダーク' : 'ミニマル'}
                </button>
              ))}
            </div>
          </div>

          {isPsych && (
            <>
              <div className="form-group">
                <label>心理学プリセット（クリックで即反映）</label>
                <div className="preset-grid">
                  {PSYCH_FACTS.map((fact) => (
                    <button
                      key={fact.number}
                      className={`preset-btn${config.title === fact.title ? ' active' : ''}`}
                      onClick={() => applyPreset(fact)}
                    >
                      <span className="preset-num">{fact.number}</span>
                      <span className="preset-name">{fact.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>キャラクター</label>
                <div className="template-buttons">
                  <button
                    className={`template-btn${showCharacter ? ' active' : ''}`}
                    onClick={() => setShowCharacter(true)}
                  >
                    表示する
                  </button>
                  <button
                    className={`template-btn${!showCharacter ? ' active' : ''}`}
                    onClick={() => setShowCharacter(false)}
                  >
                    非表示
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>{isPsych ? '原理・法則名（大見出し）' : 'タイトル'}</label>
            <textarea
              value={config.title}
              onChange={(e) => update('title', e.target.value)}
              rows={2}
              placeholder={isPsych ? '例：返報性の原理' : '大きく表示されるタイトル'}
            />
          </div>

          <div className="form-group">
            <label>{isPsych ? '説明文' : 'サブテキスト'}</label>
            <textarea
              value={config.subtitle}
              onChange={(e) => update('subtitle', e.target.value)}
              rows={4}
              placeholder={isPsych ? '分かりやすい解説を書いてください' : '詳細な説明文'}
            />
          </div>

          <div className="form-group">
            <label>ハッシュタグ</label>
            <input
              type="text"
              value={config.hashtags}
              onChange={(e) => update('hashtags', e.target.value)}
              placeholder="#心理学 #豆知識 #tiktok"
            />
          </div>

          {!isPsych && (
            <div className="form-row">
              <div className="form-group">
                <label>カラー1</label>
                <input type="color" value={config.bgColor1} onChange={(e) => update('bgColor1', e.target.value)} />
              </div>
              <div className="form-group">
                <label>カラー2</label>
                <input type="color" value={config.bgColor2} onChange={(e) => update('bgColor2', e.target.value)} />
              </div>
              <div className="form-group">
                <label>文字色</label>
                <input type="color" value={config.textColor} onChange={(e) => update('textColor', e.target.value)} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>動画の長さ: {config.duration}秒</label>
            <input
              type="range" min={8} max={30} value={config.duration}
              onChange={(e) => update('duration', Number(e.target.value))}
            />
          </div>

          {/* Voice preview button */}
          <button
            className={`voice-btn${isSpeaking ? ' speaking' : ''}`}
            onClick={isSpeaking ? stopVoice : handleVoicePreview}
            disabled={isRecording}
          >
            {isSpeaking ? '■  しゃべりを止める' : '▶  声でプレビュー（日本語TTS）'}
          </button>

          <button
            className={`record-btn${isRecording ? ' recording' : ''}`}
            onClick={startRecording}
            disabled={isRecording}
          >
            {isRecording ? `録画中... ${progress}%` : '動画を生成してダウンロード'}
          </button>

          {isRecording && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}

          {downloaded && (
            <p className="success-msg">
              ダウンロード完了！TikTokアプリで手動アップロードしてください。
            </p>
          )}

          <div className="upload-guide">
            <h3>アップロード手順</h3>
            <ol>
              <li>「声でプレビュー」でキャラクターが喋るか確認</li>
              <li>「動画を生成」で .webm をダウンロード</li>
              <li>TikTokアプリ → 「+」→「アップロード」</li>
              <li>ダウンロードした動画を選んで投稿</li>
            </ol>
          </div>
        </div>

        <div className="creator-preview">
          <p className="preview-label">プレビュー（リアルタイム）</p>
          <div className="canvas-wrapper">
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
          </div>
          <p className="canvas-size">540 × 960 (9:16)</p>
        </div>
      </div>
    </div>
  )
}
