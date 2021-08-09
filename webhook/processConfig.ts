/* eslint-disable complexity */
import { setTimeout as setPromisedTimeout } from 'timers/promises'

import { createFile as touch, readJSON, remove, writeJSON } from 'fs-promise'
import execa, { ExecaChildProcess, ExecaSyncReturnValue } from 'execa'
import CircularBuffer from 'circular-buffer'
import Bugsnag from '@bugsnag/js'

import {
  downloadAndProcessGtfsFeed,
  exists,
  uploadAndDeleteLog,
  wait,
  writeStatus,
  WebhookConfig,
  Status,
  PeliasFeed
} from './utils'

const {
  BUGSNAG_APP_TYPE,
  BUGSNAG_RELEASE_STAGE,
  PELIAS_CONFIG_DIR,
  PELIAS_UPDATE_LOCK_FILE,
  WORKER_BUGSNAG_NOTIFIER_KEY
} = require('../consts.json')

const PELIAS_CONFIG_LOCATION = `${PELIAS_CONFIG_DIR}/pelias.json`

Bugsnag.start({
  apiKey: WORKER_BUGSNAG_NOTIFIER_KEY,
  appType: BUGSNAG_APP_TYPE,
  appVersion: require('./package.json').version,
  releaseStage: BUGSNAG_RELEASE_STAGE
})

const status: Status = {
  completed: false,
  error: false,
  message: 'Initializing...',
  percentComplete: 0
}

;(async () => {
  if (process.argv.length < 3) {
    console.error('No configuration file path specified!')
    return
  }

  const configFilePath: string = process.argv.slice(2, 3)[0]
  const config: WebhookConfig = await readJSON(configFilePath)

  // Create helper function that includes the workerID to write to the correct status file
  const updateStatus = async (newStatus: Status): Promise<void> =>
    await writeStatus(newStatus, config.workerId)

  // Create helper function that fails helpfully
  const fail = async (message: string): Promise<void> => {
    await updateStatus({
      completed: true,
      error: message
    })
    // Since we're quitting, return lock
    await remove(PELIAS_UPDATE_LOCK_FILE)
    // Upload log
    await uploadAndDeleteLog(config)
    throw new Error(message)
  }

  // Begin script running and write status
  await updateStatus(status)

  // Import current Pelias config for later ammendment
  // This is not the entire Pelias config, but includes all we use here
  const peliasConfig: {
    imports: {
      csv: { download: string[] }
      transit: { feeds: PeliasFeed[] }
    }
  } = require(PELIAS_CONFIG_LOCATION)

  await updateStatus({
    message: 'Downloading GTFS feeds',
    percentComplete: 20.0
  })

  // Download and process each GTFS feed
  const newPeliasFeeds: void | PeliasFeed[] = await Promise.all(
    config.gtfsFeeds.map(downloadAndProcessGtfsFeed)
  ).catch(async (err) => {
    await fail('Something went wrong while processing GTFS files:\n' + err)
  })

  if (typeof newPeliasFeeds === 'undefined') {
    await fail('No new Pelias feeds were provided for import')
  }
  // Merge into existing pelias config
  peliasConfig.imports.transit.feeds = [
    // Include all existing feeds that don't have the ID of the new feed
    ...peliasConfig.imports.transit.feeds.filter(
      (feed: PeliasFeed) =>
        !newPeliasFeeds.map((f) => f.agencyId).includes(feed.agencyId)
    ),
    ...newPeliasFeeds
  ]

  await updateStatus({
    message: 'Importing CSV',
    percentComplete: 40.0
  })
  // We want to replace all csv files associated with the deployment
  // to remove outdated POIs
  const existingCsvNotInCurrentProject: string[] =
    peliasConfig.imports.csv.download.filter((csvUrl: string) => {
      let deploymentIdFromCsvName = ''
      // CSV urls not guaranteed to conform to the way theya are generated in
      // https://github.com/ibi-group/datatools-server/blob/dev/src/main/java/com/conveyal/datatools/manager/controllers/api/DeploymentController.java

      // Only process if length is correct
      if (csvUrl.split('/').length === 8) {
        deploymentIdFromCsvName = csvUrl.split('/')[6]
      }
      // Only keep CSV files which don't originate from this project
      // We don't garuntee deploymentId is supplied, but if it is not, this will always
      // be true
      return config.deploymentId !== deploymentIdFromCsvName
    })

  // Append CSV urls to pelias imports, merging
  // the existing and new csv URL lists
  let poiCsvUrls: string[] = config.csvFiles || []

  // Encode URLs correctly
  poiCsvUrls = poiCsvUrls.map(encodeURI)

  peliasConfig.imports.csv.download = Array.from(
    new Set([...existingCsvNotInCurrentProject, ...poiCsvUrls])
  )

  // Write new pelias config based on generated blocks
  try {
    await writeJSON(PELIAS_CONFIG_LOCATION, peliasConfig)
  } catch (err) {
    await fail(
      'Something went wrong while updating the Pelias configuration file:\n' +
        err
    )
  }

  // Check Pelias lock before updating Pelias
  let retryAttempts = 50
  while (await exists(PELIAS_UPDATE_LOCK_FILE)) {
    await updateStatus({
      message: `Another instance of this script has the lock out for updating Pelias. Waiting... [${retryAttempts} attempts left]`
    })
    // Wait before retrying
    await wait(5)
    // If too many attempts, fail
    if (--retryAttempts === 0) {
      await fail(
        "Previous processing is hanging or otherwise hasn't given up lock in time"
      )
    }
  }

  // Take out lock
  await touch(PELIAS_UPDATE_LOCK_FILE)

  // Update Pelias, and send both stderr and stdout to stdout
  await updateStatus({
    message: 'Updating Pelias',
    percentComplete: 60.0
  })
  const last50Logs: CircularBuffer = new CircularBuffer(50)

  const subprocess: ExecaChildProcess = execa(
    'sh',
    ['-c', `pelias download csv && pelias import csv && pelias import transit`],
    { all: true, cwd: PELIAS_CONFIG_DIR }
  )

  subprocess.all.pipe(process.stdout)

  // Set a timeout to avoid hanging
  const hangCheck: AbortController = new AbortController()
  const signal: AbortSignal = hangCheck.signal
  setPromisedTimeout(50000, null, { signal })
    .then(async () => await fail('Pelias update is hanging'))
    .catch((err) => {
      if (err.name === 'AbortError') console.log('Pelias did not hang')
    })

  subprocess.all.on('data', (data: ExecaSyncReturnValue) => {
    const lastMessage: string = data.toString().trim()
    if (lastMessage !== '') {
      lastMessage.split('\n').forEach((line) => {
        last50Logs.push(line)
      })
    }
  })

  // Check on Pelias as it updates. Update the status every second
  while (subprocess.exitCode === null) {
    await wait(1)

    const lastLog =
      last50Logs.size() > 1
        ? last50Logs.get(last50Logs.size() - 1) // get the most recent entry
        : ''
    await updateStatus({
      message: `Updating Pelias... ${lastLog !== '' ? ` (${lastLog})` : ''}`,
      percentComplete: 70.0
    })
  }

  // If we get here, Pelias update completed.

  // Cancel hang check
  hangCheck.abort()
  // Return lock
  await remove(PELIAS_UPDATE_LOCK_FILE)
  // either report success or failure based on exit code
  if (subprocess.exitCode > 0) {
    await fail(
      `Pelias failed to update. Pelias commands exited with non-zero exit code. Check log file for workerID ${config.workerId}`
    )
  }

  await updateStatus({
    completed: true,
    message: 'Pelias updated',
    percentComplete: 100.0
  })

  // Upload log files to s3, if upload URI specified
  await uploadAndDeleteLog(config)
})()
