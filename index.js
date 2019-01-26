const request = require('request')
const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const ytdl = require('ytdl-core')
const id3 = require('node-id3')

const { promisify } = require('util')

const { getAlbum } = require('./youtube-music')
const { initProgress } = require('./progress')

const unlink = promisify(fs.unlink)
const writeId3 = promisify((...args) => id3.write(...args))

async function fetchThumbnail (album, file) {
  const { thumbnails } = album.thumbnailDetails
  const thumbnail = thumbnails[thumbnails.length - 1]

  return new Promise((resolve, reject) => {
    request(thumbnail.url)
      .on('error', reject)
      .pipe(fs.createWriteStream(file, { flags: 'wx' }))
      .on('error', reject)
      .on('finish', () => resolve(file))
  })
}

function fetchRawTrack (bar, baseFile, url) {
  const youtubeStream = ytdl(url, {
    quality: 'highestaudio'
  })

  youtubeStream.on('progress', (chunk, downloaded, total) => {
    bar.update(downloaded, total)
  })

  return new Promise((resolve, reject) => {
    youtubeStream.on('error', reject)

    youtubeStream.on('info', (info, format) => {
      const sourceFile = `${baseFile}.${format.container}`

      bar.tag('name', sourceFile)

      youtubeStream
        .pipe(fs.createWriteStream(sourceFile))
        .on('error', reject)
        .on('finish', () => resolve(sourceFile))
    })
  })
}

function convert (bar, format, baseFile, destFile) {
  return new Promise((resolve, reject) => {
    ffmpeg(baseFile)
      .format(format)
      .on('progress', progress => {
        bar.update(progress.percent, 100)
      })
      .on('error', reject)
      .on('end', resolve)
      .save(destFile)
  })
}

async function tagTrack (track, image, file) {
  const tags = {
    title: track.title,
    artist: track.artistNames,
    album: track.albumRelease.title,
    image,
    trackNumber: track.albumTrackIndex
  }

  return writeId3(tags, file)
}

async function fetchTrack (track, bar, thumbnailPromise, baseFile, url) {
  const format = 'mp3'
  const destFile = `${baseFile}.${format}`

  bar.reset()
  bar.tag('action', 'downloading')

  const sourceFile = await fetchRawTrack(bar, baseFile, url)

  bar.reset()
  bar.tag('name', destFile)
  bar.tag('action', 'converting')

  await convert(bar, format, sourceFile, destFile)

  bar.tag('action', 'tagging')
  bar.setSchema(':name :action')

  const unlinkPromise = unlink(sourceFile)
  const tagPromise = tagTrack(track, await thumbnailPromise, destFile)

  await Promise.all([unlinkPromise, tagPromise])

  bar.tag('action', 'done')
  bar.setSchema(':name :action')
}

async function fetchAlbum (url) {
  const album = await getAlbum(url)

  for (const track of album.details.tracks) {
    track.albumRelease = album
  }

  const thumbnailFile = 'thumbnail.jpg'
  const thumbnailPromise = fetchThumbnail(album, thumbnailFile)
  const { tracks } = album.details

  const baseTitles = tracks.map(track => `${track.artistNames} - ${track.title}`)

  const progress = initProgress({
    name: baseTitles.reduce((size, title) => title.length > size ? title.length : size, 0) + 6,
    action: 12
  })

  const promises = tracks.map(track => {
    const bar = progress.add({ schema: ':name :action [:bar] :percent' })
    const baseFile = `${track.artistNames} - ${track.title}`
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(track.videoId)}`

    return fetchTrack(track, bar, thumbnailPromise, baseFile, url)
  })

  await Promise.all(promises)
  await unlink(thumbnailFile)
}

exports.fetchAlbum = fetchAlbum
