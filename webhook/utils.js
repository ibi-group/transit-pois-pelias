const path = require('path')

const {
  copyFile,
  exists,
  mkdir,
  readJSON,
  remove,
  writeJSON
} = require('fs-promise')
const execa = require('execa')
const { v4: uuidv4 } = require('uuid')

const { TEMP_DIR } = require('./consts.json')

// Helper methods
/**
 * Helper function which copies stop.txt to pelias config dir and assembles new config object
 * @param {*} parsedFeedInfo GTFS feed.txt parsed into a Javascript object
 * @param {*} feed           An object containing properties needed for processing
 * @returns                  A Pelias feed object for insertion in a Pelias config file
 */
const importGtfsData = async (feed, feedDirectory) => {
  // copy stop file to agency folder
  const feedSourceDir = path.join(
    __dirname,
    `../pelias-config/data/transit/${feed.name}/`
  )
  await mkdir(feedSourceDir, { recursive: true })
  await copyFile(`${feedDirectory}stops.txt`, `${feedSourceDir}stops.txt`)
  console.log(`Copied stops.txt for ${feed.name}`)

  // create json object for the agency
  const newPeliasFeed = {
    agencyId: feed.name,
    agencyName: feed.name,
    // Remove the part of the path irrelevant to Pelias
    filename: feedSourceDir.split('/data/transit/')[1] + 'stops.txt',
    layerId: 'stops',
    layerName: 'address'
  }
  return newPeliasFeed
}

/**
 * Downloads and unzips a GTFS zip file, extracts needed files, copies the
 * needed files into the Pelias configuration directory, and
 * generates a Pelias config object pointing to those extracted files
 * @param {*} Object containing properties needed for proecessing
 */
const downloadAndProcessGtfsFeed = async (feed) => {
  console.log(`Downloading ${feed.name} specified in manifest`)

  // Download each GTFS feed (replaces if exists)
  // Handle S3 protocol
  try {
    if (feed.uri.substr(0, 5) === 's3://') {
      await execa('aws', ['s3', 'cp', feed.uri, TEMP_DIR])
    } else {
      await execa('curl', [feed.uri, '--output', `${TEMP_DIR}${feed.filename}`])
    }
  } catch (err) {
    console.warn(`Failed to download ${feed.uri}: \n ${err}`)
  }

  // Create a random extraction directory to avoid collisions
  const extractionDir = `${TEMP_DIR}${uuidv4()}/`

  // OK to overwrite because we will copy away what we need
  await execa('unzip', [
    '-o',
    '-d',
    extractionDir,
    `${TEMP_DIR}${feed.filename}`
  ])

  return importGtfsData(feed, extractionDir)
}
module.exports.downloadAndProcessGtfsFeed = downloadAndProcessGtfsFeed

/**
 * Write updated status values to status file and create status file if it doesn't
 * already exist
 * @param {*} updatedStatus New status values. Existing status values do not need to
 * @param {*} workerId      Assigned by webhook, determines the file to write to
 * be passed, they will automatically be added
 */
const writeStatus = async (updatedStatus, workerId) => {
  const statusFile = `logs/status-${workerId}.json`
  // create status file if it doesn't exist
  if (!(await exists(statusFile))) {
    await writeJSON(statusFile, {})
  }
  // load current status
  const currentStatus = await readJSON(statusFile, 'utf-8')
  // merge statuses together
  const newStatus = { ...currentStatus, ...updatedStatus }
  // write updated status to status file
  console.log('TEMP:', newStatus)
  await writeJSON(statusFile, newStatus, 'utf-8')
}
module.exports.writeStatus = writeStatus

/**
 * Block for a specifed number of seconds
 * @param {} seconds The number of seconds to block
 */
const wait = async function (seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}
module.exports.wait = wait

/**
 * Analagous to https://github.com/ibi-group/otp-runner/blob/0f5246325595d1232c265b871b36a6fe646f7b57/lib/index.js#L629
 * uploads a log file to s3 for future inspection
 * @param {*} config  Webhook config object, used to find workerId and upload URL
 */
const uploadAndDeleteLog = async ({ logUploadUrl, workerId }) => {
  if (logUploadUrl) {
    const logPath = `logs/pelias-update-log-${workerId}.txt`
    const statusPath = `logs/status-${workerId}.json`
    try {
      await execa('aws', ['s3', 'cp', logPath, logUploadUrl])
    } catch {
      console.warn('Failed to upload log, not deleting it.')
      return
    }
    // Only remove log if it has been safely uploaded
    await remove(logPath)

    // Wait a little bit for the client to catch up, then remove status file
    await wait(10)
    await remove(statusPath)
  }
}
module.exports.uploadAndDeleteLog = uploadAndDeleteLog
