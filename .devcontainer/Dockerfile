FROM node:22-slim

WORKDIR /workspace

# Install development tools
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install global npm tools useful for development
RUN npm install -g nodemon typescript ts-node

# Create a non-root user for development
RUN groupadd -r devuser && useradd -r -g devuser -s /bin/bash devuser \
    && mkdir -p /home/devuser \
    && chown -R devuser:devuser /home/devuser /workspace

USER devuser
