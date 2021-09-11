#!/bin/bash

# !!Assumes the repository is cloned to home directory, and secrets inserted!!

# This script installs system components on AWS EC2 for installing/running a custom Pelias instance.
# Assumes you are logged-in as a user with sudo privileges.
# The package manager is apt/snap.

# Install system updates
sudo apt update -y
sudo apt upgrade -y
sudo apt install unzip -y

# Install AWS cli
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -r aws
rm awscliv2.zip

# Install node
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash - 
sudo apt install nodejs -y

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt update -y
sudo apt install yarn -y

# Install Pelias dependencies
sudo snap install docker
sudo apt install util-linux -y

# Correct Docker permissions
sudo snap connect docker:home
sudo chgrp docker $(which docker)
sudo chmod g+s $(which docker)

# Restart Docker to save changes
sudo snap disable docker
sudo snap enable docker
sudo snap start docker

# Wait for docker to start
sleep 5
# This is needed to get snap Docker to initialize fully
docker run hello-world

# Install Pelias
git clone https://github.com/pelias/docker.git && mv docker pelias-docker && cd pelias-docker
sudo ln -s "$(pwd)/pelias" /usr/local/bin/pelias

cd ~/transit-pois-pelias/pelias-config/

# Initialize containers
pelias compose pull
pelias elastic start
pelias elastic wait
pelias elastic create

# Initial import
pelias import csv
pelias import transit

# Run Pelias
pelias compose up

# Setup NGINX
sudo apt install nginx -y

# Install webhook dependencies
cd ~/transit-pois-pelias/webhook/
yarn install

# Be in script directory for copying
cd ~/transit-pois-pelias/server-install/

# Copy default config
sudo /bin/cp nginx-config /etc/nginx/sites-enabled/default

# Restart nginx
sudo systemctl restart nginx

# Copy systemd files for Pelias, Webhook
sudo /bin/cp pelias.service /lib/systemd/system/
sudo /bin/cp pelias-webhook.service /lib/systemd/system

# Enable the new services
sudo systemctl daemon-reload
sudo systemctl enable pelias

sudo systemctl unmask pelias-webhook
sudo systemctl enable pelias-webhook

# Pelias is already running
sudo systemctl start pelias-webhook