import {
  changePassword,
  getMeFromAccessToken,
  login,
  signUp,
} from '../services/auth.service.js'
import { parseOrThrow } from '../utils/validators.js'
import {
  changePasswordSchema,
  loginSchema,
  signUpSchema,
} from '../validators/auth.schemas.js'

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

export async function meController(req, res) {
  const result = await getMeFromAccessToken(req.auth.user)
  return res.status(200).json(result)
}

export async function changePasswordController(req, res) {
  const input = parseOrThrow(changePasswordSchema, req.body)

  const result = await changePassword({
    profileId: req.auth.profile.id,
    email: req.auth.user.email || req.auth.profile.email,
    senhaAtual: input.senhaAtual,
    novaSenha: input.novaSenha,
  })

  return res.status(200).json(result)
}
