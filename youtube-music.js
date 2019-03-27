const request = require('request-promise')

const browseUrl = 'https://music.youtube.com/youtubei/v1/music/browse'

// Make sniffer happy.
const userAgent = 'AppleWebKit Chrome/999'

const dummyContext = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '0.1'
  }
}

function findConfig (html) {
  html = html.substr(html.indexOf('ytcfg.set(') + 'ytcfg.set('.length)
  html = html.substr(0, html.indexOf('</script>'))
  html = html.replace(/\);?$/, '')
  return JSON.parse(html)
}

async function browse (url) {
  const html = await request({
    url,
    headers: { 'user-agent': userAgent }
  })

  const config = findConfig(html)

  const key = config.PLAYER_CONFIG.args.innertube_api_key
  const { browseEndpoint } = JSON.parse(config.INITIAL_ENDPOINT)

  const body = Object.assign({
    context: dummyContext
  }, browseEndpoint)

  return request({
    method: 'POST',
    url: browseUrl,
    qs: {
      alt: 'json',
      key
    },
    headers: {
      referer: url
    },
    json: body
  })
}

function indexMutations (mutations) {
  const index = {}

  for (const { entityKey, payload } of mutations) {
    // Normally there's ony one key
    for (const key of Object.keys(payload)) {
      index[key] = index[key] || {}
      index[key][entityKey] = payload[key]
      index[entityKey] = payload[key]
    }
  }

  return index
}

async function getAlbum (url) {
  const browseData = await browse(url)
  const { mutations } = browseData.frameworkUpdates.entityBatchUpdate
  const index = indexMutations(mutations)

  if (!index.musicAlbumRelease) {
    throw new Error('No album release found for this entity.')
  }

  const album = index.musicAlbumRelease[Object.keys(index.musicAlbumRelease)[0]]

  album.primaryArtists = album.primaryArtists.map(id => index[id])
  album.details = index[album.details]
  album.details.tracks = album.details.tracks.map(id => index[id])

  for (const track of album.details.tracks) {
    track.albumRelease = index[track.albumRelease]
  }

  return album
}

exports.browse = browse
exports.indexMutations = indexMutations
exports.getAlbum = getAlbum
