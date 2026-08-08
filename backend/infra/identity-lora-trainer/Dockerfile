# Stage 2.2A readiness image definition only.
# Do not build or run against a GPU until the explicit controlled-training stage is approved.
FROM nvidia/cuda:12.8.1-cudnn-devel-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG DIFFSYNTH_COMMIT=fb337fb

RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 python3-pip ca-certificates jq \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone --filter=blob:none https://github.com/modelscope/DiffSynth-Studio.git \
  && cd DiffSynth-Studio \
  && git checkout --detach "${DIFFSYNTH_COMMIT}" \
  && git rev-parse HEAD > /opt/DIFFSYNTH_RESOLVED_COMMIT

WORKDIR /opt/privacy-readiness
COPY trainer.lock.json dataset_manifest.example.json training_config.example.json ./
COPY scripts/audit_readiness.py ./scripts/audit_readiness.py
COPY TRAIN_DRY_RUN.sh ./TRAIN_DRY_RUN.sh
RUN chmod +x ./TRAIN_DRY_RUN.sh

ENV PRIVACY_LORA_DRY_RUN_ONLY=true \
    PRIVACY_LORA_ALLOW_MODEL_DOWNLOADS=false \
    PRIVACY_LORA_ALLOW_RUNPOD=false \
    PRIVACY_LORA_ALLOW_TRAINING=false

ENTRYPOINT ["/opt/privacy-readiness/TRAIN_DRY_RUN.sh"]
