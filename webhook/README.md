# Pelias Updater Webhook

When the custom Pelias instance is deployed, updating it is tedious. It involves copying files to the configuration directory, and running the pelias import commands.

This is a server which listens for requests from datatools. The GTFS feeds described within the config sent by datatools will be unzipped, parsed and copied to the Pelias configuration directory. The pelias.json config file will then be updated to read these new feeds. Finally, pelias import commands will automatically be run to import the new feeds.

_This script makes quite a few assumptions about how and where it and Pelias are installed (see `consts.example.json`). If the scripts within server-install are used, the webhook will work._

## Running the Webhook server

First, create `consts.json` based on the provided example file.

_This server requires Node.js 16+_

`yarn start` will start a server on port `3000`. The server is desinged to be run out of a `dist/` directory. `yarn start` will automatically transpile the typescript and start the server from the correct directory.

### Datatools-UI considerations

If running locally at the same time as Datatools-UI, there may be some node depdendency issues. If your node version manager is not env based, have Datatools-UI running _before_ changing the node version and starting the webhook server.
