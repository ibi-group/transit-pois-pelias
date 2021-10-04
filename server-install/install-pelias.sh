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
yarn build

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