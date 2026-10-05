# Imagen compartida por el simulador y el worker (cambia solo el comando).
# Node 24 ejecuta TypeScript directamente (type stripping): no hay paso de compilación.
FROM node:24-alpine

WORKDIR /app
ENV KAFKAJS_NO_PARTITIONER_WARNING=1
# Aviso conocido e inofensivo de kafkajs con Node 24.
ENV NODE_OPTIONS=--disable-warning=TimeoutNegativeWarning

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
