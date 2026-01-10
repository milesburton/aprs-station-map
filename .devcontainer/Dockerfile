FROM node:22-slim

ARG USER_UID=1000
ARG USER_GID=1000

WORKDIR /workspace

# Install development tools
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

# Install global npm tools useful for development
RUN npm install -g nodemon typescript ts-node

# Use existing node user (UID/GID 1000) and add sudo access
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && chown -R node:node /workspace

# Create .ssh directory with correct permissions
RUN mkdir -p /home/node/.ssh \
    && chown node:node /home/node/.ssh \
    && chmod 700 /home/node/.ssh

USER node
