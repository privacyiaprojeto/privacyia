import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(here, '..', '..')
const auditPath = path.join(backendRoot, 'src', 'services', 'actor-identity-training-target-audit.service.js')
const dispatchPath = path.join(backendRoot, 'src', 'services', 'actor-identity-training-dispatch.service.js')

const audit = fs.readFileSync(auditPath, 'utf8')
const dispatch = fs.existsSync(dispatchPath) ? fs.readFileSync(dispatchPath, 'utf8') : null

test('HF target audit v2 removes legacy VACE hardcodes from current audit result', () => {
  assert.match(audit, /privacy-identity-training-target-audit-v2/)
  assert.doesNotMatch(audit, /loraBaseModel:\s*'vace'/)
  assert.doesNotMatch(audit, /removePrefixInCheckpoint:\s*'pipe\.vace\.'/)
  assert.doesNotMatch(audit, /verdict:\s*'current_vace_control_adapter_not_general_video_identity_proven'/)
  assert.doesNotMatch(audit, /blockers\.push\(blocker\('CANDIDATE_TRAINING_CONTRACT_NOT_PREFLIGHTED'/)
})

test('HF target audit v2 recognizes the exact approved DiT module contract', () => {
  for (const moduleName of [
    'cross_attn.q',
    'cross_attn.k',
    'cross_attn.v',
    'cross_attn.o',
    'ffn.0',
    'ffn.2',
  ]) {
    assert.ok(audit.includes(`'${moduleName}'`), `audit missing ${moduleName}`)
    if (dispatch) {
      assert.ok(dispatch.includes(`'${moduleName}'`), `dispatch missing ${moduleName}`)
    }
  }

  if (dispatch) {
    assert.match(dispatch, /lora_base_model:\s*'dit'/)
    assert.match(dispatch, /remove_prefix_in_ckpt:\s*'pipe\.dit\.'/)
    assert.match(dispatch, /vace_frozen:\s*true/)
  }
})

test('HF target audit v2 remains fail-closed for production and paid tests', () => {
  assert.match(audit, /nextPaidTestAllowed:\s*false/)
  assert.match(audit, /currentAdapterReusableForProduction:\s*false/)
  assert.match(audit, /productReleased:\s*false/)
  assert.match(audit, /adapterApproved:\s*false/)
  assert.match(audit, /gpuStarted:\s*false/)
  assert.match(audit, /runPodCalled:\s*false/)
})

test('HF target audit v2 can technically pass without approving visual identity', () => {
  assert.match(audit, /status:\s*technicalPassed\s*\?\s*'passed'\s*:\s*'failed'/)
  assert.match(audit, /verdict:\s*technicalPassed\s*\?\s*'wan_dit_identity_target_verified'/)
  assert.match(audit, /paidExecutionApproved:\s*technicalPassed/)
  assert.match(audit, /generalGeneratorIdentityBranchPresent:\s*technicalPassed/)
})
