import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(here, '..', '..')

function read(rel) {
  return fs.readFileSync(path.join(backendRoot, rel), 'utf8')
}

const env = read('src/config/env.js')
const policy = read('src/services/actor-identity-preview-policy.service.js')
const preview = read('src/services/actor-identity-preview.service.js')
const forensic = read('src/services/actor-identity-video-forensic.service.js')
const lora = read('src/services/actor-identity-lora.service.js')
const review = read('src/services/actor-identity-review-decision.service.js')

test('motion ABC contract replaces legacy raw-RGB preview contract', () => {
  assert.match(env, /privacy-identity-motion-abc-v1/)
  assert.match(policy, /privacy-identity-motion-abc-v1/)
  assert.match(preview, /controlled_identity_motion_abc/)
  assert.match(preview, /softedge_ffmpeg_edgedetect_v1/)
  assert.match(preview, /raw_rgb_control_allowed:\s*false/)
  assert.doesNotMatch(preview, /D3\.6H12-trigger-token-raw-rgb-v2v-denoise-085-v1/)
})

test('preview requires three isolated branches and attested LoRA in C', () => {
  assert.match(preview, /baseline_without_identity/)
  assert.match(preview, /identity_reference_without_lora/)
  assert.match(preview, /candidate_with_lora/)
  assert.match(preview, /providerAssets\.length !== 3/)
  assert.match(preview, /branchA\.kyc === false/)
  assert.match(preview, /branchB\.kyc === true/)
  assert.match(preview, /branchB\.lora === false/)
  assert.match(preview, /branchC\.lora === true/)
  assert.match(preview, /patched_model_key_count/)
  assert.match(preview, /assertTrainingTargetReadyForPreview/)
})

test('forensic v2 proves provenance instead of claiming motion-only', () => {
  assert.match(forensic, /privacy-identity-video-forensic-audit-v2/)
  assert.match(forensic, /video_softedge_abc_v1/)
  assert.match(forensic, /appearanceReducedStructuralControlUsed/)
  assert.match(forensic, /rawRgbControlUsed/)
  assert.match(forensic, /sameControlAcrossBranches/)
  assert.match(forensic, /loraIsolationComparisonAvailable/)
  assert.doesNotMatch(forensic, /motionOnlyControlUsed:\s*true/)
})

test('final approval remains fail-closed behind forensic ABC evidence', () => {
  assert.match(review, /SOFTEDGE_CONTROL_NOT_PROVEN/)
  assert.match(review, /RAW_RGB_CONTROL_FORBIDDEN/)
  assert.match(review, /IDENTITY_REFERENCE_WITHOUT_LORA_MISSING/)
  assert.match(review, /LORA_ISOLATION_COMPARISON_MISSING/)
  assert.match(lora, /finalApprovalAllowed/)
  assert.match(lora, /video_softedge_abc_v1/)
  assert.match(lora, /nextPaidTestAllowed:\s*false/)
})
