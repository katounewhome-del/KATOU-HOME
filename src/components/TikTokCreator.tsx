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
  title: string
  subtitle: string
  number: string
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
      '「見てはいけない」「やってはいけない」と言われるほど気になってしまう心理。禁止が欲求を高めます。',
  },
  {
    number: 'No.5',
    title: 'ハロー効果',
    subtitle:
      '外見が良い人は仕事もできると思い込むなど、一つの特徴が全体の評価に影響してしまう心理です。',
  },
  {
    number: 'No.6',
    title: '吊り橋効果',
    subtitle:
      'ドキドキする状況で一緒にいる人に恋愛感情を抱きやすくなる心理。不安や興奮が恋と混同されます。',
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
      '完了したことより未完了なことの方が記憶に残りやすい心理。ドラマの「続きは次回！」はこれを利用しています。',
  },
  {
    number: 'No.9',
    title: 'ピーク・エンドの法則',
    subtitle:
      '体験の評価は「一番感情が動いた瞬間」と「終わり方」で決まる心理。終わりよければすべてよし。',
  },
  {
    number: 'No.10',
    title: 'フット・イン・ザ・ドア',
    subtitle:
      '小さなお願いを先に聞いてもらうと、次に大きなお願いも通りやすくなる心理。段階的説得法とも呼ばれます。',
  },
]

const CANVAS_W = 540
const CANVAS_H = 960
const FPS = 30

function easeOut(progress: number, start: number, end: number): number {
  const t = Math.min(1, Math.max(0, (progress - start) / (end - start)))
  return 1 - Math.pow(1 - t, 3)
}

// Character-level wrap (works for Japanese)
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
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
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
    duration: 10,
    template: 'psych',
  })
  const [psychNum, setPsychNum] = useState('No.1')
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloaded, setDownloaded] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const previewStartRef = useRef<number | null>(null)

  const drawPsychFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number, num: string) => {
      const w = CANVAS_W
      const h = CANVAS_H
      const dur = config.duration
      const norm = t / dur

      // ── Background: deep dark indigo ──
      const bg = ctx.createLinearGradient(0, 0, w, h)
      bg.addColorStop(0, '#08081e')
      bg.addColorStop(1, '#1a0535')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Pulsing glow in center
      const pulseR = 0.5 + Math.sin(t * 1.8) * 0.08
      const glow = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, h * pulseR)
      glow.addColorStop(0, 'rgba(120, 60, 255, 0.18)')
      glow.addColorStop(0.5, 'rgba(60, 20, 180, 0.08)')
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // Animated neural-network dots
      ctx.globalAlpha = 0.25
      const nodes = [
        [0.15, 0.2],
        [0.85, 0.15],
        [0.1, 0.55],
        [0.9, 0.5],
        [0.2, 0.8],
        [0.8, 0.75],
        [0.5, 0.12],
        [0.5, 0.88],
      ]
      for (const [nx, ny] of nodes) {
        const px = nx * w + Math.sin(t * 0.4 + nx * 5) * 12
        const py = ny * h + Math.cos(t * 0.3 + ny * 5) * 12
        // Connecting lines
        for (const [nx2, ny2] of nodes) {
          const px2 = nx2 * w + Math.sin(t * 0.4 + nx2 * 5) * 12
          const py2 = ny2 * h + Math.cos(t * 0.3 + ny2 * 5) * 12
          const dist = Math.hypot(px2 - px, py2 - py)
          if (dist < 280) {
            ctx.strokeStyle = `rgba(160, 100, 255, ${(1 - dist / 280) * 0.4})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(px, py)
            ctx.lineTo(px2, py2)
            ctx.stroke()
          }
        }
        ctx.fillStyle = 'rgba(180, 130, 255, 0.8)'
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // ── Top bar ──
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(0, 0, w, 72)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('おすすめ', w / 2, 44)

      // ── Brain badge ──
      const badgeP = easeOut(norm, 0.0, 0.2)
      ctx.globalAlpha = badgeP
      const badgeW = 280
      const badgeH = 52
      const badgeX = (w - badgeW) / 2
      const badgeY = 96
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 26)
      const badgeBg = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY)
      badgeBg.addColorStop(0, '#7b3fff')
      badgeBg.addColorStop(1, '#3b82f6')
      ctx.fillStyle = badgeBg
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🧠 心理学豆知識', w / 2, badgeY + 34)
      ctx.globalAlpha = 1

      // ── Number ──
      const numP = easeOut(norm, 0.1, 0.3)
      ctx.globalAlpha = numP * 0.6
      ctx.fillStyle = '#a78bff'
      ctx.font = 'bold 32px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(num, w / 2, 196)
      ctx.globalAlpha = 1

      // ── Divider line ──
      const lineP = easeOut(norm, 0.12, 0.32)
      ctx.globalAlpha = lineP * 0.5
      const lineW = lineP * 200
      const lineGrad = ctx.createLinearGradient(w / 2 - lineW, 0, w / 2 + lineW, 0)
      lineGrad.addColorStop(0, 'transparent')
      lineGrad.addColorStop(0.5, '#a78bff')
      lineGrad.addColorStop(1, 'transparent')
      ctx.strokeStyle = lineGrad
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(w / 2 - lineW, 214)
      ctx.lineTo(w / 2 + lineW, 214)
      ctx.stroke()
      ctx.globalAlpha = 1

      // ── Title (principle name) ──
      const tp = easeOut(norm, 0.15, 0.45)
      ctx.globalAlpha = tp
      ctx.shadowColor = 'rgba(160, 100, 255, 0.8)'
      ctx.shadowBlur = 24
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold 68px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.title, w / 2, h * 0.36 - (1 - tp) * 36, w - 80, 82)
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // ── Subtitle card ──
      const sp = easeOut(norm, 0.45, 0.72)
      ctx.globalAlpha = sp
      const cardH = 220
      const cardY = h * 0.55
      roundRect(ctx, 36, cardY, w - 72, cardH, 20)
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fill()
      roundRect(ctx, 36, cardY, w - 72, cardH, 20)
      ctx.strokeStyle = 'rgba(160,100,255,0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = 'rgba(220, 200, 255, 0.9)'
      ctx.font = `28px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.subtitle, w / 2, cardY + 46, w - 120, 40)
      ctx.globalAlpha = 1

      // ── Right-side TikTok buttons ──
      const bp = easeOut(norm, 0.35, 0.6)
      ctx.globalAlpha = bp * 0.85
      const bx = w - 44
      const btns: [string, string, number][] = [
        ['♥', '9.4k', 0.52],
        ['💬', '312', 0.63],
        ['↗', 'シェア', 0.74],
      ]
      for (const [icon, label, fy] of btns) {
        ctx.font = '38px sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(icon, bx, h * fy)
        ctx.font = 'bold 17px sans-serif'
        ctx.fillText(label, bx, h * fy + 26)
      }
      ctx.globalAlpha = 1

      // ── Hashtag bar ──
      const hp = easeOut(norm, 0.75, 0.93)
      ctx.globalAlpha = hp
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, h - 116, w, 116)
      ctx.fillStyle = '#c4b5fd'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(config.hashtags, w / 2, h - 44)
      ctx.globalAlpha = 1
    },
    [config],
  )

  const drawGeneralFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const w = CANVAS_W
      const h = CANVAS_H
      const dur = config.duration
      const norm = t / dur

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
        ctx.globalAlpha = 1
      }

      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(0, 0, w, 72)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 26px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('おすすめ', w / 2, 46)

      const tp = easeOut(norm, 0.1, 0.4)
      const titleColor = config.template === 'minimal' ? '#111111' : config.textColor
      ctx.globalAlpha = tp
      ctx.shadowColor = config.template === 'minimal' ? 'transparent' : 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 10
      ctx.fillStyle = titleColor
      ctx.font = `bold 56px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.title, w / 2, h * 0.38 - (1 - tp) * 40, w - 80, 68)
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      const sp = easeOut(norm, 0.42, 0.68)
      const subColor = config.template === 'minimal' ? '#444444' : `${config.textColor}cc`
      ctx.globalAlpha = sp
      ctx.fillStyle = subColor
      ctx.font = `30px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.subtitle, w / 2, h * 0.56, w - 100, 40)
      ctx.globalAlpha = 1

      const bp = easeOut(norm, 0.3, 0.6)
      ctx.globalAlpha = bp * 0.9
      const bx = w - 42
      const items: [string, string, number][] = [
        ['♥', '12.3k', 0.52],
        ['💬', '423', 0.63],
        ['↗', 'シェア', 0.74],
      ]
      for (const [icon, label, fy] of items) {
        ctx.font = '38px sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.fillText(icon, bx, h * fy)
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText(label, bx, h * fy + 28)
      }
      ctx.globalAlpha = 1

      const hp = easeOut(norm, 0.72, 0.92)
      ctx.globalAlpha = hp
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, h - 120, w, 120)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 26px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(config.hashtags, w / 2, h - 48)
      ctx.globalAlpha = 1
    },
    [config],
  )

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      if (config.template === 'psych') {
        drawPsychFrame(ctx, t, psychNum)
      } else {
        drawGeneralFrame(ctx, t)
      }
    },
    [config.template, drawPsychFrame, drawGeneralFrame, psychNum],
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

  const startRecording = () => {
    const canvas = canvasRef.current
    if (!canvas || isRecording) return

    cancelAnimationFrame(rafRef.current)
    setIsRecording(true)
    setProgress(0)
    setDownloaded(false)

    const ctx = canvas.getContext('2d')!
    const stream = canvas.captureStream(FPS)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
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
        {/* Settings Panel */}
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
                  {t === 'psych'
                    ? '🧠 心理学'
                    : t === 'gradient'
                      ? 'グラデーション'
                      : t === 'dark'
                        ? 'ダーク'
                        : 'ミニマル'}
                </button>
              ))}
            </div>
          </div>

          {isPsych && (
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
                <input
                  type="color"
                  value={config.bgColor1}
                  onChange={(e) => update('bgColor1', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>カラー2</label>
                <input
                  type="color"
                  value={config.bgColor2}
                  onChange={(e) => update('bgColor2', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>文字色</label>
                <input
                  type="color"
                  value={config.textColor}
                  onChange={(e) => update('textColor', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>動画の長さ: {config.duration}秒</label>
            <input
              type="range"
              min={5}
              max={30}
              value={config.duration}
              onChange={(e) => update('duration', Number(e.target.value))}
            />
          </div>

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
              <li>上のボタンで動画(.webm)をダウンロード</li>
              <li>TikTokアプリを開く</li>
              <li>「+」ボタン → 「アップロード」を選択</li>
              <li>ダウンロードした動画を選んで投稿</li>
            </ol>
          </div>
        </div>

        {/* Preview Panel */}
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
