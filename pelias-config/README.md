# Custom Pelias Instance

This project is configured to download/prepare/build a complete Pelias installation.

The expensive interpolation, polylines, and placeholder containers have been removed. Some Elasticsearch data is shipped to avoid these expensive Pelias components.

The synonyms folder contains Elasticsearch synonyms which can be used to help Elasticsearch find otherwise difficult to search for points. Its initial values are copied from the Pelias example project. These can be used to address any search issues which arise.

A rudimentary example custom CSV file is included in the `data/csv` folder.

# Setup

Please refer to the instructions at https://github.com/pelias/docker in order to install and configure your docker environment.

The minimum configuration required in order to run this project are [installing prerequisites](https://github.com/pelias/docker#prerequisites), [install the pelias command](https://github.com/pelias/docker#installing-the-pelias-helper-script) and [configure the environment](https://github.com/pelias/docker#configure-environment).

Be careful to not run the Pelias default project. The prepare and interpolation steps especially can take over an hour to run!

If Pelias is installed globally, then running the commands listed in the build step below will work.

Before running the build step, clone this repository into a seperate directory from the pelias install.

```bash
git clone https://github.com/ibi-group/transit-pois-pelias
cd transit-pois-pelias/pelias-config
```

# Run a Build

By default, the instance will only load the example csv file. Transit data can be loaded in using the webhook.

The `pelias.json` file provided here will ensure that the pelias instance built is as minimal as possible, only serving csv and transit results.

`pelias elastic create` is not included in these steps because ElasticSearch data is included in this directory.

To run a complete build, execute the following commands _in this directory_:

```bash
pelias compose pull
pelias elastic start
pelias elastic wait
pelias import csv
pelias compose up
```

Some errors may appear. This is expected and a byproduct of removing un-used Pelias components.

# Make an Example Query

You can now make queries against your new Pelias build:

- http://localhost:4000/v1/search?text=mariner
- http://localhost:4000/v1/autocomplete?text=mariner

It may take up to a minute for ElasticSearch to finish updating, so for the first minute of the server's existence the feature output may be blank. If updating an existing server, they will only be outdated for that minute.

# Server Install

To deploy this instance on a server (along with the associated webhook), an install script is provided in the `server-install` directory. More information is provided in the README in that directory.
