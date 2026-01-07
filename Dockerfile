FROM debian:bookworm-slim AS builder

WORKDIR /app

RUN echo "1" > /var/lib/dpkg/info/format \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get update --allow-insecure-repositories \
    && apt-get install -y --allow-unauthenticated ca-certificates gnupg curl unzip \
    && mkdir -p /etc/apt/keyrings \
    && for key in 6ED0E7B82643E131 78DBA3BC47EF2265 F8D2585B8783D481 54404762BBB6E853 BDE6D2B9216EC7A8; do \
         for i in 1 2 3 4 5; do \
           gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys $key && break || sleep 5; \
         done; \
       done \
    && gpg --export 6ED0E7B82643E131 78DBA3BC47EF2265 F8D2585B8783D481 54404762BBB6E853 BDE6D2B9216EC7A8 | tee /etc/apt/trusted.gpg.d/debian.gpg > /dev/null \
    && apt-get update \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

COPY package.json bun.lock* ./
RUN /root/.bun/bin/bun install --ignore-scripts

COPY . .
RUN /root/.bun/bin/bun run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
