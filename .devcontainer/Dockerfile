FROM node:22-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    curl \
    wget \
    jq \
    vim \
    htop \
    less \
    procps \
    sudo \
    ripgrep \
    fd-find \
    fzf \
    tree \
    ncdu \
    net-tools \
    iputils-ping \
    openssh-client \
    gh \
    # Playwright dependencies \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g nodemon typescript ts-node

RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && chown -R node:node /workspace

RUN mkdir -p /home/node/.ssh \
    && chown node:node /home/node/.ssh \
    && chmod 700 /home/node/.ssh

USER node
