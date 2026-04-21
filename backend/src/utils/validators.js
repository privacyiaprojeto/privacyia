import { ApiError } from './apiError.js'

export function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload)
  if (!result.success) {
    throw new ApiError(422, 'Payload inválido.', result.error.flatten())
  }
  return result.data
}
