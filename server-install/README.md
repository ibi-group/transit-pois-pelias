# Server Install Scripts

The scripts here are for installing a Pelias server for transit and csv use only on an Amazon EC2 (although other Ubuntu Server instances should also work). For installing locally, please refer to the instructions in the `pelias-config` folder.

`server-install.sh` installs the dependencies needed to run `install-pelias.sh`. The scripts are split to allow Docker group changes to register in the shell.

This script was tested with Ubuntu 20.04 on an Amazon EC2 r5a.large. However, it should work with any Ubuntu/Debian-based server with minimal changes.

The script assumes this repository has been copied to the home directory of the default ubuntu user (as a folder `transit-pois-pelias`). Running the `pelias-start.sh` script will then install all needed dependencies, set them up and launch the Pelias instance and a webhook for adding content to the instance.

The server will run on port 80 (via nginx). Please note that by default there is no protection of the server. This should be done via firewall rules.