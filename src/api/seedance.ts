// fal.ai Seedance integration
// Docs: https://fal.ai/models/fal-ai/bytedance/seedance/v1/lite/text-to-video/api

const FAL_QUEUE_BASE = 'https://queue.fal.run'
const SEEDANCE_MODEL = 'fal-ai/bytedance/seedance/v1/lite/text-to-video'

export interface SeedanceRequest {
  prompt: string
  aspect_ratio?: '9:16' | '16:9' | '1:1'
  duration?: '5' | '10'
  resolution?: '480p' | '720p' | '1080p'
}

export interface SeedanceProgressUpdate {
  status: 'submitting' | 'queued' | 'in_progress' | 'completed' | 'failed'
  position?: number
  message: string
}

interface SubmitResponse {
  request_id: string
}

interface StatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  queue_position?: number
}

interface ResultResponse {
  video?: { url: string }
}

export async function generateSeedanceVideo(
  apiKey: string,
  request: SeedanceRequest,
  onProgress: (update: SeedanceProgressUpdate) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!apiKey.trim()) throw new Error('APIキーが未設定です')

  onProgress({ status: 'submitting', message: 'fal.aiに送信中...' })

  const submitResp = await fetch(`${FAL_QUEUE_BASE}/${SEEDANCE_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: request.prompt,
      aspect_ratio: request.aspect_ratio ?? '9:16',
      duration: request.duration ?? '5',
      resolution: request.resolution ?? '720p',
    }),
    signal,
  })

  if (!submitResp.ok) {
    const errText = await submitResp.text().catch(() => '')
    throw new Error(`送信失敗 (${submitResp.status}): ${errText.slice(0, 200)}`)
  }

  const { request_id }: SubmitResponse = await submitResp.json()

  for (let i = 0; i < 150; i++) {
    if (signal?.aborted) throw new Error('キャンセルされました')
    await new Promise((r) => setTimeout(r, 2000))

    const statusResp = await fetch(
      `${FAL_QUEUE_BASE}/${SEEDANCE_MODEL}/requests/${request_id}/status`,
      { headers: { Authorization: `Key ${apiKey}` }, signal },
    )
    if (!statusResp.ok) throw new Error(`ステータス取得失敗 (${statusResp.status})`)
    const status: StatusResponse = await statusResp.json()

    if (status.status === 'IN_QUEUE') {
      onProgress({
        status: 'queued',
        position: status.queue_position,
        message: `キュー待機中${status.queue_position != null ? `（${status.queue_position}番目）` : ''}...`,
      })
    } else if (status.status === 'IN_PROGRESS') {
      onProgress({ status: 'in_progress', message: '動画生成中...（30〜90秒）' })
    } else if (status.status === 'COMPLETED') {
      break
    } else {
      throw new Error(`生成失敗: ${status.status}`)
    }
  }

  const resultResp = await fetch(
    `${FAL_QUEUE_BASE}/${SEEDANCE_MODEL}/requests/${request_id}`,
    { headers: { Authorization: `Key ${apiKey}` }, signal },
  )
  if (!resultResp.ok) throw new Error(`結果取得失敗 (${resultResp.status})`)
  const result: ResultResponse = await resultResp.json()
  if (!result.video?.url) throw new Error('動画URLが含まれていませんでした')

  onProgress({ status: 'completed', message: '完成！' })
  return result.video.url
}

export async function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('動画の読み込みに失敗しました'))
    setTimeout(() => reject(new Error('読み込みタイムアウト')), 30000)
  })

  try {
    await video.play()
  } catch {
    // Auto-play may fail; we'll seek manually for offline encoding
  }
  return video
}
