import { useState, useRef, useEffect, useCallback } from 'react'

interface VideoConfig {
  title: string
  subtitle: string
  hashtags: string
  bgColor1: string
  bgColor2: string
  textColor: string
  duration: number
  template: 'gradient' | 'dark' | 'minimal'
}

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
  const words = text.split(' ')
  let line = ''
  let currentY = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY)
      line = word + ' '
      currentY += lineHeight
    } else {
      line = test
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY)
}

export function TikTokCreator() {
  const [config, setConfig] = useState<VideoConfig>({
    title: 'すごいタイトル',
    subtitle: 'ここに説明文を入力してください。詳しい内容を書きましょう。',
    hashtags: '#tiktok #japan #viral #trend',
    bgColor1: '#ff0050',
    bgColor2: '#00f2ea',
    textColor: '#ffffff',
    duration: 8,
    template: 'gradient',
  })
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloaded, setDownloaded] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const previewStartRef = useRef<number | null>(null)

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      const w = CANVAS_W
      const h = CANVAS_H
      const dur = config.duration
      const norm = t / dur

      // Background
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
        // Subtle accent bar
        ctx.fillStyle = config.bgColor1
        ctx.fillRect(0, 0, w, 8)
      } else {
        const grad = ctx.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, config.bgColor1)
        grad.addColorStop(1, config.bgColor2)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }

      // Floating circles (decorative)
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

      // Top bar (TikTok style)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(0, 0, w, 72)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 26px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('おすすめ', w / 2, 46)

      // Title animation (slide up + fade in)
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

      // Subtitle animation (fade in)
      const sp = easeOut(norm, 0.42, 0.68)
      const subColor = config.template === 'minimal' ? '#444444' : `${config.textColor}cc`
      ctx.globalAlpha = sp
      ctx.fillStyle = subColor
      ctx.font = `30px sans-serif`
      ctx.textAlign = 'center'
      wrapText(ctx, config.subtitle, w / 2, h * 0.56, w - 100, 40)
      ctx.globalAlpha = 1

      // Right-side action buttons (TikTok UI)
      const bp = easeOut(norm, 0.3, 0.6)
      ctx.globalAlpha = bp * 0.9
      ctx.textAlign = 'center'
      const bx = w - 42
      const items: [string, string, number][] = [
        ['♥', '12.3k', 0.52],
        ['💬', '423', 0.63],
        ['↗', 'シェア', 0.74],
      ]
      for (const [icon, label, fy] of items) {
        ctx.font = '38px sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(icon, bx, h * fy)
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText(label, bx, h * fy + 28)
      }
      ctx.globalAlpha = 1

      // Bottom hashtag bar
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

  // Preview loop
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
      a.download = `tiktok_video_${Date.now()}.webm`
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

  return (
    <div className="tiktok-creator">
      <div className="creator-layout">
        {/* Settings Panel */}
        <div className="creator-form">
          <h2 className="form-title">動画設定</h2>

          <div className="form-group">
            <label>テンプレート</label>
            <div className="template-buttons">
              {(['gradient', 'dark', 'minimal'] as const).map((t) => (
                <button
                  key={t}
                  className={`template-btn${config.template === t ? ' active' : ''}`}
                  onClick={() => update('template', t)}
                >
                  {t === 'gradient' ? 'グラデーション' : t === 'dark' ? 'ダーク' : 'ミニマル'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>タイトル</label>
            <textarea
              value={config.title}
              onChange={(e) => update('title', e.target.value)}
              rows={2}
              placeholder="大きく表示されるタイトル"
            />
          </div>

          <div className="form-group">
            <label>サブテキスト</label>
            <textarea
              value={config.subtitle}
              onChange={(e) => update('subtitle', e.target.value)}
              rows={3}
              placeholder="詳細な説明文"
            />
          </div>

          <div className="form-group">
            <label>ハッシュタグ</label>
            <input
              type="text"
              value={config.hashtags}
              onChange={(e) => update('hashtags', e.target.value)}
              placeholder="#tiktok #viral"
            />
          </div>

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
              <li>ダウンロードした動画を選択して投稿</li>
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
