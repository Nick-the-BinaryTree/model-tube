# Use phusion/baseimage as base image. To make your builds
# reproducible, make sure you lock down to a specific version, not
# to `latest`! See
# https://github.com/phusion/baseimage-docker/blob/master/Changelog.md
# for a list of version numbers.
FROM phusion/baseimage:0.9.19

# Use baseimage-docker's init system.
CMD ["/sbin/my_init"]

# ...put your own build instructions here...

# Install Node.js
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -

RUN apt-get update && apt-get install -y \
    build-essential \
    nodejs

# Install git
Run apt-get update && apt-get install -y git

# end of own instructions

# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Custom instructions to setup a local non-root user
RUN useradd -ms /bin/bash docker

WORKDIR /var/www/html

# Switch to docker user before below
USER docker

# Upgrade npm
RUN mkdir ~/.npm-global
RUN npm config set prefix '~/.npm-global'
RUN echo "export PATH=~/.npm-global/bin:$PATH" >> ~/.bashrc
RUN npm install npm@latest -g

# Switch back to root to avoid explosions on build
USER root
