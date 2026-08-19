import assert from 'node:assert/strict'
import test from 'node:test'
import { buildClientMediaContract, buildVideoPlaybackReadiness } from './media-contract.service.js'
import {
  assertSceneDirectionProductType,
  filterExplicitLiveActionProducts,
  filterExplicitLiveAudioProducts,
  normalizeMediaProductType,
  resolveSceneDirectionProductType,
} from './media-product-type.service.js'
import { buildProtectedPurchaseContract } from './media-purchase-contract.service.js'
import { inspectProtectedVideoRendererReadiness } from './video-renderer-readiness.service.js'

const availableRenderer = {
  ready: true,
  status: 'AVAILABLE',
  reasonCode: 'VIDEO_RENDERER_AVAILABLE',
  userMessage: null,
  blockers: [],
}

const availableHlsPlayback = buildVideoPlaybackReadiness({
  id: 'rendition-hls-1',
  rendition_type: 'hls_stream',
  status: 'available',
})

function videoFixture() {
  return {
    delivery: { id: 'delivery-1' },
    asset: {
      id: 'asset-1',
      media_type: 'short_video',
      status: 'available',
      r2_bucket: 'private-media',
      r2_key: 'private/masters/video-1.mp4',
      current_assignments: 0,
      max_assignments: 1,
    },
    combination: {
      id: 'combination-1',
      media_type: 'short_video',
      status: 'active',
      is_active: true,
      visible_to_client: true,
      admin_only: false,
      price_credits: 80,
    },
  }
}

function audioFixture() {
  return {
    delivery: { id: 'delivery-audio-1' },
    asset: {
      id: 'asset-audio-1',
      combination_id: 'combination-audio-1',
      media_type: 'audio',
      status: 'available',
      r2_bucket: 'private-media',
      r2_key: 'private/masters/audio-1.mp3',
      current_assignments: 0,
      max_assignments: 1,
    },
    combination: {
      id: 'combination-audio-1',
      media_type: 'audio',
      status: 'active',
      is_active: true,
      visible_to_client: true,
      admin_only: false,
      price_credits: 20,
    },
  }
}

function persistedSceneDirectionProductFixture(productType = 'live_action') {
  return {
    id: 'scene-direction-product-1',
    asset: {
      id: 'scene-direction-asset-1',
      media_type: 'video',
      status: 'qa_pending',
      metadata: {
        source: 'scene_direction_studio',
        productType,
        productionMode: 'v2v',
      },
    },
    combination: {
      id: 'scene-direction-combination-1',
      media_type: 'video',
      content_type: 'video',
      visible_to_client: false,
      admin_only: true,
      metadata: {
        source: 'scene_direction_studio',
        productType,
        productionMode: 'v2v',
      },
    },
  }
}

test('renderer ausente, desabilitado ou sem storage permanece fail-closed', () => {
  const notConfigured = inspectProtectedVideoRendererReadiness({
    gateConfigured: false,
    enabled: false,
    privateStorageConfigured: false,
  })
  const disabled = inspectProtectedVideoRendererReadiness({
    gateConfigured: true,
    enabled: false,
    privateStorageConfigured: true,
  })
  const notReady = inspectProtectedVideoRendererReadiness({
    gateConfigured: true,
    enabled: true,
    privateStorageConfigured: false,
  })
  const productionNotReady = inspectProtectedVideoRendererReadiness({
    gateConfigured: true,
    enabled: true,
    privateStorageConfigured: true,
    requireRenditionPipeline: true,
    renditionPipelineConfigured: false,
  })
  const available = inspectProtectedVideoRendererReadiness({
    gateConfigured: true,
    enabled: true,
    privateStorageConfigured: true,
    requireRenditionPipeline: true,
    renditionPipelineConfigured: true,
  })

  assert.deepEqual(
    [notConfigured.status, disabled.status, notReady.status, productionNotReady.status],
    ['NOT_CONFIGURED', 'DISABLED', 'NOT_READY', 'NOT_READY'],
  )
  assert.equal(notConfigured.ready, false)
  assert.equal(disabled.ready, false)
  assert.equal(notReady.ready, false)
  assert.equal(productionNotReady.ready, false)
  assert.deepEqual(productionNotReady.blockers, ['protected_video_rendition_pipeline_not_ready'])
  assert.equal(available.status, 'AVAILABLE')
  assert.equal(available.ready, true)
})

test('vídeo reconhecido não abre quando o gate do renderer está desabilitado', () => {
  const contract = buildClientMediaContract({
    ...videoFixture(),
    videoRendererReadiness: {
      ready: false,
      status: 'DISABLED',
      reasonCode: 'VIDEO_RENDERER_DISABLED',
      userMessage: 'A abertura protegida de vídeo está desabilitada.',
      blockers: ['protected_video_renderer_gate_disabled'],
    },
  })

  assert.equal(contract.clientSupported, true)
  assert.equal(contract.clientOpenable, false)
  assert.equal(contract.clientPurchasable, false)
  assert.equal(contract.protectedRenderer, null)
  assert.equal(contract.reasonCode, 'VIDEO_RENDERER_DISABLED')
})

test('renderer disponível só abre vídeo com delivery e storage privados válidos', () => {
  const ready = buildClientMediaContract({
    ...videoFixture(),
    videoRendererReadiness: availableRenderer,
    videoPlaybackReadiness: availableHlsPlayback,
  })
  const missingDelivery = buildClientMediaContract({
    ...videoFixture(),
    delivery: null,
    videoRendererReadiness: availableRenderer,
  })

  assert.equal(ready.clientOpenable, true)
  assert.equal(ready.clientPurchasable, false)
  assert.equal(ready.protectedRenderer, 'video')
  assert.equal(ready.reasonCode, 'OPENABLE_VIDEO_PROTECTED_DELIVERY')
  assert.equal(missingDelivery.clientOpenable, false)
  assert.equal(missingDelivery.reasonCode, 'VIDEO_MISSING_PROTECTED_DELIVERY_OR_STORAGE')
})

test('compra de vídeo continua sem cobrança ou criação de delivery', () => {
  const { asset, combination } = videoFixture()
  const contract = buildProtectedPurchaseContract({
    profileId: 'profile-1',
    asset,
    combination,
  })

  assert.equal(contract.clientPurchasable, false)
  assert.equal(contract.canCharge, false)
  assert.equal(contract.canCreateDeliveryAfterCharge, false)
  assert.equal(contract.paymentAction, 'BLOCKED')
  assert.equal(contract.reasonCode, 'VIDEO_PURCHASE_NOT_ENABLED_YET')
})

test('metadata semântica de Live Action prevalece sobre transporte de vídeo genérico', () => {
  const fixture = videoFixture()
  fixture.asset.media_type = 'video'
  fixture.asset.metadata = { productType: 'live_action_v2v', productionMode: 'v2v' }
  fixture.combination.media_type = 'video'
  fixture.combination.metadata = { contentType: 'live_action', productionMode: 'v2v' }

  const normalized = normalizeMediaProductType(fixture.asset, fixture.combination)
  const mediaContract = buildClientMediaContract({
    ...fixture,
    videoRendererReadiness: availableRenderer,
    videoPlaybackReadiness: availableHlsPlayback,
  })
  const purchaseContract = buildProtectedPurchaseContract({
    profileId: 'profile-1',
    asset: fixture.asset,
    combination: fixture.combination,
  })

  assert.equal(normalized.mediaType, 'live_action')
  assert.equal(mediaContract.clientOpenable, false)
  assert.equal(mediaContract.protectedRenderer, null)
  assert.equal(mediaContract.reasonCode, 'LIVE_ACTION_INTERACTIVE_RENDERER_NOT_READY')
  assert.equal(purchaseContract.clientPurchasable, false)
  assert.equal(purchaseContract.canCharge, false)
  assert.equal(purchaseContract.canCreateDeliveryAfterCharge, false)
  assert.equal(purchaseContract.reasonCode, 'LIVE_ACTION_PURCHASE_NOT_READY')
})

test('shape persistido pelo Scene Direction Worker mantém Live Action explícito', () => {
  const product = persistedSceneDirectionProductFixture()
  const direction = {
    production_mode: 'v2v',
    metadata: {
      productType: 'live_action',
      requestContext: {
        source: 'actor_pipeline_live_action',
        productType: 'live_action',
        contentType: 'live_action',
      },
    },
    provider_payload: {
      productionMode: 'v2v',
      requestContext: {
        productType: 'live_action',
        contentType: 'live_action',
      },
    },
  }

  const normalized = normalizeMediaProductType(product.asset, product.combination)

  assert.equal(normalized.mediaType, 'live_action')
  assert.equal(normalized.conflict, false)
  assert.deepEqual(
    filterExplicitLiveActionProducts([product]).map((item) => item.id),
    [product.id],
  )
  assert.equal(resolveSceneDirectionProductType(direction), 'live_action')
  assert.equal(assertSceneDirectionProductType(direction), 'live_action')
})

test('semântica de produto é compatível com transporte genérico da mesma família', () => {
  const cases = [
    [{ productType: 'live_action', media_type: 'video', content_type: 'video' }, 'live_action'],
    [{ productType: 'short_video', media_type: 'video', content_type: 'video' }, 'short_video'],
    [{ productType: 'live_audio', media_type: 'audio', content_type: 'audio' }, 'audio_live'],
    [{ productType: 'audio', media_type: 'audio', content_type: 'audio' }, 'audio'],
  ]

  for (const [input, expectedMediaType] of cases) {
    const normalized = normalizeMediaProductType(input)
    assert.equal(normalized.mediaType, expectedMediaType)
    assert.equal(normalized.conflict, false)
  }
})

test('semântica de produto incompatível com a família de transporte falha fechado', () => {
  const cases = [
    { productType: 'live_action', media_type: 'audio', content_type: 'audio' },
    { productType: 'short_video', media_type: 'audio', content_type: 'audio' },
    { productType: 'audio', media_type: 'video', content_type: 'video' },
    { productType: 'live_audio', media_type: 'video', content_type: 'video' },
  ]

  for (const input of cases) {
    const normalized = normalizeMediaProductType(input)
    assert.equal(normalized.mediaType, 'conflict')
    assert.equal(normalized.conflict, true)
    assert.equal(normalized.reasonCode, 'MEDIA_PRODUCT_SEMANTIC_CONFLICT')
  }
})

test('V2V de vídeo padrão não é promovido a Live Action nem recebe blocker interativo', () => {
  const fixture = videoFixture()
  fixture.asset.media_type = 'video'
  fixture.asset.metadata = { productType: 'short_video', productionMode: 'v2v' }
  fixture.combination.media_type = 'video'
  fixture.combination.metadata = { contentType: 'short_video', productionMode: 'v2v' }

  const normalized = normalizeMediaProductType(fixture.asset, fixture.combination)
  const mediaContract = buildClientMediaContract({
    ...fixture,
    videoRendererReadiness: availableRenderer,
    videoPlaybackReadiness: availableHlsPlayback,
  })
  const purchaseContract = buildProtectedPurchaseContract({
    profileId: 'profile-1',
    asset: fixture.asset,
    combination: fixture.combination,
  })

  assert.equal(normalized.mediaType, 'short_video')
  assert.equal(mediaContract.clientOpenable, true)
  assert.equal(mediaContract.reasonCode, 'OPENABLE_VIDEO_PROTECTED_DELIVERY')
  assert.notEqual(mediaContract.reasonCode, 'LIVE_ACTION_INTERACTIVE_RENDERER_NOT_READY')
  assert.equal(purchaseContract.reasonCode, 'VIDEO_PURCHASE_NOT_ENABLED_YET')
  assert.notEqual(purchaseContract.reasonCode, 'LIVE_ACTION_PURCHASE_NOT_READY')
})

test('Scene Direction exige intenção explícita para classificar Live Action', () => {
  const genericV2v = {
    production_mode: 'v2v',
    metadata: { requestContext: { source: 'generic_video' } },
    provider_payload: { productionMode: 'v2v' },
  }
  const explicitLiveAction = {
    production_mode: 'v2v',
    metadata: { requestContext: { productType: 'live_action' } },
  }

  assert.equal(resolveSceneDirectionProductType(genericV2v), 'short_video')
  assert.equal(resolveSceneDirectionProductType({ production_mode: 'v2v' }), 'short_video')
  assert.equal(resolveSceneDirectionProductType(explicitLiveAction), 'live_action')
  assert.equal(assertSceneDirectionProductType(genericV2v), 'short_video')
  assert.equal(assertSceneDirectionProductType(explicitLiveAction), 'live_action')
  assert.notEqual(resolveSceneDirectionProductType(genericV2v), 'live_action')
})

test('Scene Direction rejeita conflitos semânticos sem fallback para short_video', () => {
  const liveActionVsShortVideo = {
    production_mode: 'v2v',
    metadata: {
      requestContext: {
        productType: 'live_action',
        contentType: 'short_video',
      },
    },
  }
  const shortVideoVsAudio = {
    production_mode: 'v2v',
    metadata: {
      requestContext: {
        productType: 'short_video',
        contentType: 'audio',
      },
    },
  }
  const audioVsVideo = {
    production_mode: 'v2v',
    metadata: {
      requestContext: {
        productType: 'audio',
        contentType: 'video',
      },
    },
  }
  const liveActionVsLiveAudio = {
    production_mode: 'v2v',
    metadata: {
      requestContext: {
        productType: 'live_action',
        contentType: 'live_audio',
      },
    },
  }

  for (const direction of [liveActionVsShortVideo, shortVideoVsAudio, audioVsVideo, liveActionVsLiveAudio]) {
    assert.equal(resolveSceneDirectionProductType(direction), 'conflict')
    assert.notEqual(resolveSceneDirectionProductType(direction), 'short_video')
    assert.throws(
      () => assertSceneDirectionProductType(direction),
      (error) => (
        error?.statusCode === 422
        && error?.details?.reasonCode === 'MEDIA_PRODUCT_SEMANTIC_CONFLICT'
        && error?.details?.productType === 'conflict'
      ),
    )
  }
})

test('playback protegido pronto não depende de worker ou rendition queue de geração', () => {
  const playbackReadiness = inspectProtectedVideoRendererReadiness({
    gateConfigured: true,
    enabled: true,
    privateStorageConfigured: true,
    requireRenditionPipeline: false,
    renditionPipelineConfigured: false,
  })

  assert.equal(playbackReadiness.ready, true)
  assert.equal(playbackReadiness.status, 'AVAILABLE')
})

test('Live Audio com arquivo TTS permanece bloqueado sem contrato audiovisual e lip sync', () => {
  const fixture = audioFixture()
  fixture.asset.metadata = { productType: 'live_audio' }
  fixture.combination.metadata = { contentType: 'live_audio' }

  const mediaContract = buildClientMediaContract(fixture)
  const purchaseContract = buildProtectedPurchaseContract({
    profileId: 'profile-1',
    asset: fixture.asset,
    combination: fixture.combination,
  })

  assert.equal(mediaContract.mediaType, 'audio_live')
  assert.equal(mediaContract.clientOpenable, false)
  assert.equal(mediaContract.protectedRenderer, null)
  assert.equal(mediaContract.reasonCode, 'LIVE_AUDIO_AUDIOVISUAL_RENDERER_NOT_READY')
  assert.equal(purchaseContract.clientPurchasable, false)
  assert.equal(purchaseContract.canCharge, false)
  assert.equal(purchaseContract.canCreateDeliveryAfterCharge, false)
  assert.equal(purchaseContract.reasonCode, 'LIVE_AUDIO_AUDIOVISUAL_PURCHASE_NOT_READY')
})

test('áudio comum continua separado de Live Audio e usa entrega protegida de áudio', () => {
  const fixture = audioFixture()
  const mediaContract = buildClientMediaContract(fixture)
  const purchaseContract = buildProtectedPurchaseContract({
    profileId: 'profile-1',
    asset: fixture.asset,
    combination: fixture.combination,
  })

  assert.equal(mediaContract.mediaType, 'audio')
  assert.equal(mediaContract.clientOpenable, true)
  assert.equal(mediaContract.protectedRenderer, 'audio')
  assert.equal(mediaContract.reasonCode, 'OPENABLE_AUDIO_PROTECTED_DELIVERY')
  assert.equal(purchaseContract.clientPurchasable, true)
  assert.equal(purchaseContract.canCharge, true)
  assert.equal(purchaseContract.canCreateDeliveryAfterCharge, true)
  assert.equal(purchaseContract.reasonCode, 'PURCHASABLE_AUDIO_PROTECTED_DELIVERY')
})

test('agrupamentos de perfil aceitam somente semântica explícita de Live Action e Live Audio', () => {
  const products = [
    { id: 'standard-video', mediaType: 'short_video' },
    { id: 'legacy-video', mediaType: 'video' },
    { id: 'legacy-short-video', mediaType: 'video_curto' },
    { id: 'live-action', mediaType: 'live_action' },
    { id: 'live-action-alias', mediaType: 'live_action_v2v' },
    { id: 'standard-audio', mediaType: 'audio' },
    { id: 'chat-audio', mediaType: 'audio_chat' },
    { id: 'tts-audio', mediaType: 'tts' },
    { id: 'live-audio', mediaType: 'audio_live' },
    { id: 'live-audio-alias', mediaType: 'live_audio' },
  ]

  assert.deepEqual(
    filterExplicitLiveActionProducts(products).map((product) => product.id),
    ['live-action', 'live-action-alias'],
  )
  assert.deepEqual(
    filterExplicitLiveAudioProducts(products).map((product) => product.id),
    ['live-audio', 'live-audio-alias'],
  )
  assert.equal(products.length, 10)
  assert.equal(products.some((product) => product.id === 'standard-video'), true)
  assert.equal(products.some((product) => product.id === 'standard-audio'), true)
})

test('vídeo padrão exige prova explícita de rendition HLS available para abrir', () => {
  const fixture = videoFixture()
  const missingReadiness = buildClientMediaContract({
    ...fixture,
    videoRendererReadiness: availableRenderer,
  })
  const progressiveOnly = buildClientMediaContract({
    ...fixture,
    videoRendererReadiness: availableRenderer,
    videoPlaybackReadiness: buildVideoPlaybackReadiness({
      id: 'preview-1',
      rendition_type: 'preview',
      status: 'available',
    }),
  })
  const hlsReady = buildClientMediaContract({
    ...fixture,
    videoRendererReadiness: availableRenderer,
    videoPlaybackReadiness: availableHlsPlayback,
  })

  assert.equal(missingReadiness.clientOpenable, false)
  assert.equal(missingReadiness.reasonCode, 'VIDEO_HLS_RENDITION_NOT_READY')
  assert.equal(progressiveOnly.clientOpenable, false)
  assert.equal(progressiveOnly.reasonCode, 'VIDEO_HLS_RENDITION_NOT_READY')
  assert.equal(hlsReady.clientOpenable, true)
  assert.equal(hlsReady.reasonCode, 'OPENABLE_VIDEO_PROTECTED_DELIVERY')
})

test('semântica explícita incompatível com media_type de outra família falha fechado', () => {
  const standardVideo = normalizeMediaProductType({
    productType: 'short_video',
    media_type: 'audio',
  })
  const standardAudio = normalizeMediaProductType({
    productType: 'audio',
    media_type: 'video',
  })

  assert.equal(standardVideo.mediaType, 'conflict')
  assert.equal(standardVideo.conflict, true)
  assert.equal(standardAudio.mediaType, 'conflict')
  assert.equal(standardAudio.conflict, true)
})

test('conflito entre intenções semânticas explícitas falha fechado e nunca cobra', () => {
  const fixture = videoFixture()
  fixture.asset.metadata = { productType: 'short_video' }
  fixture.combination.metadata = { contentType: 'audio' }

  const normalized = normalizeMediaProductType(fixture.asset, fixture.combination)
  const mediaContract = buildClientMediaContract({
    ...fixture,
    videoRendererReadiness: availableRenderer,
    videoPlaybackReadiness: availableHlsPlayback,
  })
  const purchaseContract = buildProtectedPurchaseContract({
    profileId: 'profile-1',
    asset: fixture.asset,
    combination: fixture.combination,
  })

  assert.equal(normalized.conflict, true)
  assert.equal(normalized.mediaType, 'conflict')
  assert.equal(mediaContract.clientOpenable, false)
  assert.equal(mediaContract.reasonCode, 'MEDIA_PRODUCT_SEMANTIC_CONFLICT')
  assert.equal(purchaseContract.clientPurchasable, false)
  assert.equal(purchaseContract.canCharge, false)
  assert.equal(purchaseContract.canCreateDeliveryAfterCharge, false)
  assert.equal(purchaseContract.reasonCode, 'MEDIA_PRODUCT_SEMANTIC_CONFLICT')
})
