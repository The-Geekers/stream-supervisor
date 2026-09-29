FROM node:24-alpine
WORKDIR /app
COPY observer.js ./
ENV DOCKER_SOCKET=/var/run/docker.sock
ENV OUTPUT_FILE=/output/status.json
ENV OBSERVER_INTERVAL_MS=2000
CMD ["node","observer.js"]
