FROM oven/bun:1.2

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

USER bun

ENV PATH="/home/bun/.local/bin:$PATH"
