# Pelias Stitcher

Some users would like their OTP instance location autocomplete responses to include custom POIs as well as bus stops. This information is supplied in custom CSV files ([in a format Pelias understands](https://github.com/pelias/csv-importer)) and GTFS stops.txt files.

The `server-install` directory includes scripts and configuration files to launch the custom [Pelias](https://github.com/pelias/docker) instance which serves the custom responses. More details about the scripts [are available in the `server-install` directory](https://github.com/ibi-group/transit-pois-pelias/tree/master/server-install).

The `pelias-config` directory contains configuration files for the Pelias instance `server-install` installs. It also includes [instructions for running this server locally](https://github.com/ibi-group/transit-pois-pelias/tree/master/pelias-config).

The `webhook` directory contains an express server which allows for using Datatools to update Pelias, importing all new stops and POIs. More information about the server and how to run it [is available in the `webhook` directory](https://github.com/ibi-group/transit-pois-pelias/tree/master/webhook).

### Known Issues
- The webhook can only replace GTFS feeds, not delete them. If the webhook receives a deployment with a feed currently in Pelias missing, it will ignore the existing feed and add the new one. This can be troublesome when renaming a feed, as duplication can occur. In this case for now, the feed has to be manually removed from the `pelias.json` in the `pelias-config` folder and `pelias import transit` manually run.
- Stop IDs sometimes conflict with OTP stop IDs. This is under investigation.