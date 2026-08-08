#!/usr/bin/env python3
import hashlib
import json
import os
import re
import sys
from pathlib import Path

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def fail(message: str) -> None:
    print(f"READINESS_BLOCKER={message}", file=sys.stderr)
    raise SystemExit(2)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"invalid_json:{path.name}:{exc}")


def main() -> None:
    if os.getenv("PRIVACY_LORA_DRY_RUN_ONLY", "true").lower() != "true":
        fail("dry_run_only_must_be_true")
    if os.getenv("PRIVACY_LORA_ALLOW_RUNPOD", "false").lower() == "true":
        fail("runpod_must_remain_disabled")
    if os.getenv("PRIVACY_LORA_ALLOW_TRAINING", "false").lower() == "true":
        fail("training_must_remain_disabled")

    manifest_path = Path(sys.argv[1] if len(sys.argv) > 1 else "dataset_manifest.example.json")
    config_path = Path(sys.argv[2] if len(sys.argv) > 2 else "training_config.example.json")
    lock_path = Path(sys.argv[3] if len(sys.argv) > 3 else "trainer.lock.json")
    manifest = load_json(manifest_path)
    config = load_json(config_path)
    lock = load_json(lock_path)

    if manifest.get("schemaVersion") != "privacy-identity-dataset-manifest-v1":
        fail("unsupported_dataset_manifest_schema")
    if config.get("schemaVersion") != "privacy-vace-identity-lora-training-config-v1":
        fail("unsupported_training_config_schema")
    if lock.get("dryRunOnly") is not True or lock.get("runPodAllowedDuringReadiness") is not False:
        fail("trainer_lock_not_fail_closed")
    if manifest.get("baseModel") != lock.get("baseModel") or config.get("baseModel") != lock.get("baseModel"):
        fail("base_model_mismatch")
    if manifest.get("trainingEngineCommit") != lock.get("commit"):
        fail("training_engine_commit_mismatch")
    if config.get("mode") != "readiness_dry_run" or config.get("runPodSubmission") is not False:
        fail("config_not_dry_run")

    actor_id = str(manifest.get("actorProfileId", ""))
    case_id = str(manifest.get("kycCaseId", ""))
    if not UUID_RE.match(actor_id) or not UUID_RE.match(case_id):
        fail("invalid_actor_or_kyc_case_id")
    if not re.match(r"^prv_actor_[0-9a-f]{8}_v[0-9]+$", str(manifest.get("triggerToken", ""))):
        fail("invalid_generic_trigger_token")

    destination = manifest.get("destination") or {}
    if destination.get("public") is not False:
        fail("dataset_destination_must_be_private")
    if str(destination.get("prefix", "")).startswith("http") or str(destination.get("bucket", "")).startswith("http"):
        fail("url_not_allowed_in_dataset_destination")
    if not str(destination.get("prefix", "")).startswith(f"identity-training/{actor_id}/"):
        fail("invalid_identity_training_prefix")

    assets = manifest.get("assets") or []
    if not assets:
        fail("dataset_assets_empty")
    for asset in assets:
        source = asset.get("source") or {}
        key = str(source.get("key", ""))
        bucket = str(source.get("bucket", ""))
        if not key.startswith("vault/actor-mapping/") or key.startswith("http") or bucket.startswith("http"):
            fail("asset_outside_private_mapping_vault")
        checksum = asset.get("checksumSha256")
        if checksum is not None and not SHA256_RE.match(str(checksum)):
            fail("invalid_asset_checksum")
        if "document" in str(asset.get("systemTag", "")).lower() or "identity_card" in str(asset.get("systemTag", "")).lower():
            fail("identity_document_must_not_enter_training_dataset")

    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    digest = hashlib.sha256(canonical).hexdigest()
    print("STAGE_2_2A_VACE_IDENTITY_LORA_READINESS_READY")
    print(f"dataset_manifest_sha256={digest}")
    print(f"assets={len(assets)}")
    print(f"engine_commit={lock.get('commit')}")
    print("training_started=false")
    print("runpod_called=false")
    print("gpu_started=false")
    print("r2_copied=false")
    print("automatic_retry=false")


if __name__ == "__main__":
    main()
