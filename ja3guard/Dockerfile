FROM golang:1.22-bookworm AS builder

WORKDIR /app
COPY . .
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o ja3guard .

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/ja3guard /usr/local/bin/ja3guard

RUN mkdir -p /data

EXPOSE 80 443 8443

ENTRYPOINT ["ja3guard"]
CMD ["-config", "/data/config.json"]
