#!/usr/bin/env bash
set -euo pipefail

: "${PRIVACY_LORA_DRY_RUN_ONLY:=true}"
: "${PRIVACY_LORA_ALLOW_MODEL_DOWNLOADS:=false}"
: "${PRIVACY_LORA_ALLOW_RUNPOD:=false}"
: "${PRIVACY_LORA_ALLOW_TRAINING:=false}"

if [[ "${PRIVACY_LORA_DRY_RUN_ONLY}" != "true" \
   || "${PRIVACY_LORA_ALLOW_MODEL_DOWNLOADS}" != "false" \
   || "${PRIVACY_LORA_ALLOW_RUNPOD}" != "false" \
   || "${PRIVACY_LORA_ALLOW_TRAINING}" != "false" ]]; then
  echo "STAGE_2_2A_FAIL_CLOSED: flags de treinamento/RunPod/model download devem permanecer desligadas." >&2
  exit 2
fi

MANIFEST="${1:-dataset_manifest.example.json}"
CONFIG="${2:-training_config.example.json}"
LOCK="${3:-trainer.lock.json}"
python3 scripts/audit_readiness.py "${MANIFEST}" "${CONFIG}" "${LOCK}"

echo "TRAINING_COMMAND_NOT_EXECUTED"
echo "A etapa futura deverá montar o comando DiffSynth somente após aprovação humana e flags adicionais explícitas."
