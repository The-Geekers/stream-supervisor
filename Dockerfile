FROM node:24-alpine
WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public

RUN mkdir -p /host/proc/net /host/disk \
    && touch /host/proc/stat /host/proc/meminfo /host/proc/loadavg /host/proc/uptime /host/proc/net/dev /host/proc/net/route \
    && chown -R node:node /host

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8090

EXPOSE 8090

USER node
CMD ["npm", "start"]
