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
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g nodemon typescript ts-node

RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && chown -R node:node /workspace

RUN mkdir -p /home/node/.ssh \
    && chown node:node /home/node/.ssh \
    && chmod 700 /home/node/.ssh

USER node
