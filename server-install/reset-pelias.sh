#!/bin/sh -e
# Reset Pelias
# Assumes Pelias is installed and running
cd ~/transit-pois-pelias/pelias-config && pelias elastic drop -f && pelias elastic create && pelias download csv && pelias import csv && pelias import transit && pelias compose down && ~/transit-pois-pelias/server-install/pelias-start.sh