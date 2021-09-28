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
sudo groupadd docker
sudo usermod -aG docker $USER
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
