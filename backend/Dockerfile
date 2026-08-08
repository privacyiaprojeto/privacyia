FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      tini \
    && command -v ffmpeg \
    && command -v ffprobe \
    && ffmpeg -version \
    && ffprobe -version \
    && tini --version \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --chown=node:node src ./src

USER node

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start"]
