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

# Create a non-root user with matching UID/GID for proper file permissions
RUN groupadd -g ${USER_GID} devuser \
    && useradd -u ${USER_UID} -g ${USER_GID} -m -s /bin/bash devuser \
    && echo "devuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/devuser \
    && chmod 0440 /etc/sudoers.d/devuser \
    && chown -R devuser:devuser /workspace

# Create .ssh directory with correct permissions
RUN mkdir -p /home/devuser/.ssh \
    && chown devuser:devuser /home/devuser/.ssh \
    && chmod 700 /home/devuser/.ssh

USER devuser
