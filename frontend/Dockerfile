FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/out ./out

EXPOSE 3000

CMD ["sh", "-c", "while true; do sleep 3600; done"]
