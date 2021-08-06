#!/bin/bash
cd /home/ubuntu/transit-pois-pelias/pelias-config

# Skipping pull and create, assuming already done
pelias elastic start
pelias elastic wait
# Skipping download and import, assuming already done
pelias compose up