FROM node:24-alpine
WORKDIR /app
COPY controller.js ./
ENV DOCKER_SOCKET=/var/run/docker.sock
ENV CONTROL_PORT=8181
ENV DOCKER_RESTART_CONTAINER=restreamer
EXPOSE 8181
CMD ["node","controller.js"]
