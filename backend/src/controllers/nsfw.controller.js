import { parseOrThrow } from '../utils/validators.js'
import {
  denunciarGeracaoSchema,
  gerarImagemSchema,
  gerarVideoSchema,
} from '../validators/nsfw.schemas.js'
import {
  createImageGeneration,
  createVideoGeneration,
  listGeneratedImages,
  listGeneratedVideos,
  listImageOptions,
  listSubscribedActresses,
  listVideoOptions,
  reportImageGeneration,
  reportVideoGeneration,
} from '../services/nsfw.service.js'

export async function listSubscribedActressesController(req, res) {
  const data = await listSubscribedActresses(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function listImageOptionsController(_req, res) {
  const data = await listImageOptions()
  return res.status(200).json(data)
}

export async function createImageGenerationController(req, res) {
  const input = parseOrThrow(gerarImagemSchema, req.body)
  const data = await createImageGeneration(req.auth.profile.id, input)
  return res.status(201).json(data)
}

export async function listGeneratedImagesController(req, res) {
  const data = await listGeneratedImages(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function reportImageGenerationController(req, res) {
  const input = parseOrThrow(denunciarGeracaoSchema, req.body)
  const data = await reportImageGeneration(req.auth.profile.id, req.params.id, input.motivo)
  return res.status(200).json(data)
}

export async function listVideoOptionsController(_req, res) {
  const data = await listVideoOptions()
  return res.status(200).json(data)
}

export async function createVideoGenerationController(req, res) {
  const input = parseOrThrow(gerarVideoSchema, req.body)
  const data = await createVideoGeneration(req.auth.profile.id, input)
  return res.status(201).json(data)
}

export async function listGeneratedVideosController(req, res) {
  const data = await listGeneratedVideos(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function reportVideoGenerationController(req, res) {
  const input = parseOrThrow(denunciarGeracaoSchema, req.body)
  const data = await reportVideoGeneration(req.auth.profile.id, req.params.id, input.motivo)
  return res.status(200).json(data)
}
