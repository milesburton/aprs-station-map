FROM oven/bun:1.2

WORKDIR /workspace

RUN rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get update --allow-insecure-repositories \
    && apt-get install -y --allow-unauthenticated ca-certificates gnupg curl \
    && mkdir -p /etc/apt/keyrings \
    && for key in 6ED0E7B82643E131 78DBA3BC47EF2265 F8D2585B8783D481 54404762BBB6E853 BDE6D2B9216EC7A8; do \
         for i in 1 2 3 4 5; do \
           gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys $key && break || sleep 5; \
         done; \
       done \
    && gpg --export 6ED0E7B82643E131 78DBA3BC47EF2265 F8D2585B8783D481 54404762BBB6E853 BDE6D2B9216EC7A8 | tee /etc/apt/trusted.gpg.d/debian.gpg > /dev/null \
    && apt-get update \
    && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

USER bun

ENV PATH="/home/bun/.local/bin:$PATH"
