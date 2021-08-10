import { access, copyFile, mkdir } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'

import { readJSON, remove, writeJSON } from 'fs-promise'
import execa from 'execa'
import { v4 as uuidv4 } from 'uuid'

const { PELIAS_CONFIG_DIR, TEMP_DIR } = require('../consts.json')

// Types
export type WebhookConfig = {
  csvFiles: Array<string>
  deploymentId: string
  gtfsFeeds: Array<{ filename: string; name: string; uri: string }>
  logUploadUrl: string
  workerId: string
}
export type WebhookFeed = {
  filename: string
  name: string
  uri: string
}
export type Status = {
  completed?: boolean
  error?: string | boolean
  message?: string
  percentComplete?: number
}
export type PeliasFeed = {
  agencyId: string
  agencyName: string
  filename: string
  layerId: string
  layerName: string
}

// Helper methods
/**
 * Helper function which copies stop.txt to pelias config dir and assembles new config object
 * @param {*} feedDirectory  Directory containing GTFS feed
 * @param {*} feed           An object containing properties needed for processing
 * @returns                  A Pelias feed object for insertion in a Pelias config file
 */
export const importGtfsData = async (
  feed: WebhookFeed,
  feedDirectory: string
): Promise<PeliasFeed> => {
  // copy stop file to agency folder
  const feedSourceDir = path.join(
    `../${PELIAS_CONFIG_DIR}/data/transit/${feed.name}/`
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
export const downloadAndProcessGtfsFeed = async (
  feed: WebhookFeed
): Promise<PeliasFeed> => {
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
    return null
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

/**
 * Write updated status values to status file and create status file if it doesn't
 * already exist
 * @param {*} updatedStatus New status values. Existing status values do not need to
 * @param {*} workerId      Assigned by webhook, determines the file to write to
 * be passed, they will automatically be added
 */
export const writeStatus = async (
  updatedStatus: Status,
  workerId: string
): Promise<void> => {
  const statusFile = `logs/status-${workerId}.json`
  // create status file if it doesn't exist
  if (!(await exists(statusFile))) {
    await writeJSON(statusFile, {})
  }
  // load current status
  const currentStatus = await readJSON(statusFile)
  // merge statuses together
  const newStatus = { ...currentStatus, ...updatedStatus }
  // write updated status to status file
  console.log('TEMP:', newStatus)
  await writeJSON(statusFile, newStatus)
}

/**
 * Block for a specifed number of seconds
 * @param {number} seconds The number of seconds to block
 */
export const wait = async function (seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

/**
 * Analagous to
 * https://github.com/ibi-group/otp-runner/blob/0f5246325595d1232c265b871b36a6fe646f7b57/lib/index.js#L629
 * uploads a log file to s3 for future inspection
 * @param {*} config  Webhook config object, used to find workerId and upload URL
 */
export const uploadAndDeleteLog = async ({
  logUploadUrl,
  workerId
}: {
  logUploadUrl: string
  workerId: string
}): Promise<void> => {
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

/**
 * Checks if a file path exists
 * @param path  Path to check
 * @returns     true if the file exists, false if it doesn't
 */
export const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}
