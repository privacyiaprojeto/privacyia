import { login, signUp } from '../services/auth.service.js'
import { parseOrThrow } from '../utils/validators.js'
import { loginSchema, signUpSchema } from '../validators/auth.schemas.js'

export async function loginController(req, res) {
  const input = parseOrThrow(loginSchema, req.body)
  const result = await login(input)
  return res.status(200).json(result)
}

export async function signUpController(req, res) {
  const input = parseOrThrow(signUpSchema, req.body)
  const result = await signUp(input)
  return res.status(201).json(result)
}
