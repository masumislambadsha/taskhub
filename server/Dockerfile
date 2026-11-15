# syntax=docker/dockerfile:1
# TaskHub realtime server (Express + Socket.io). Plain JavaScript, no build step.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY --chown=node:node . .

USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "index.js"]
