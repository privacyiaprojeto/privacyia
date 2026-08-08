export const QUEUE_NAMES = {
  IMAGE: 'media:image',
  VIDEO_SHORT: 'media:video-short',
  VIDEO_V2V: 'media:video-v2v',
  AUDIO: 'media:audio',
  RENDITION: 'media:rendition',
}

export const JOB_NAMES = {
  IMAGE_DRY_RUN_ITEM: 'image.dry-run.item',
  IMAGE_REAL_ITEM: 'image.real.item',
  ACTOR_PIPELINE_IMAGE_STAGE: 'image.actor-pipeline.stage',
  VIDEO_SHORT_SCENE_DIRECTION: 'video-short.scene-direction',
  VIDEO_V2V_SCENE_DIRECTION: 'video-v2v.scene-direction',
  AUDIO_LIVE_ITEM: 'audio.live.item',
  RENDITION_CREATE: 'rendition.create',
  RENDITION_PREVIEW: 'rendition.preview',
  RENDITION_HLS_STREAM: 'rendition.hls-stream',

  // Aliases de compatibilidade de nome de job. Não representam uma fila única.
  FACTORY_MOCK_ITEM: 'image.dry-run.item',
  FACTORY_REAL_IMAGE_ITEM: 'image.real.item',
  FACTORY_SCENE_DIRECTION: 'video-v2v.scene-direction',
  ACTOR_PIPELINE_LIVE_AUDIO: 'audio.live.item',
}
