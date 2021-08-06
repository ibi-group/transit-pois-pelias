# Pelias Stitcher

Some users would like their OTP instance location autocomplete responses to include custom POIs as well as bus stops. This information is supplied in custom CSV files ([in a format Pelias understands](https://github.com/pelias/csv-importer)) and GTFS stops.txt files.

The `server-install` directory includes scripts and configuration files to launch the custom [Pelias](https://github.com/pelias/docker) instance which serves the custom responses.

The `pelias-config` directory contains configuration files for the Pelias instance `server-install` installs. It also includes instructions for running this server locally.

The `webhook` directory contains an express server which allows for using Datatools to update Pelias, importing all new stops and POIs.
