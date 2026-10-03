FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY lib ./lib
COPY public ./public

RUN mkdir -p /host/proc /host/net /host/disk /data \
    && touch /host/proc/stat /host/proc/meminfo /host/proc/loadavg /host/proc/uptime /host/net/rx_bytes /host/net/tx_bytes \
    && chown -R node:node /host /data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8090

EXPOSE 8090

USER node
CMD ["npm", "start"]
