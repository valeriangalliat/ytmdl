const request = require('request-promise')

const entityUrl = 'https://music.youtube.com/youtubei/v1/music/entity_browse'

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

async function getEntity (url) {
  const html = await request({
    url,
    headers: { 'user-agent': userAgent }
  })

  const config = findConfig(html)

  const key = config.PLAYER_CONFIG.args.innertube_api_key
  const { musicEntityBrowseEndpoint } = JSON.parse(config.INITIAL_ENDPOINT)

  const body = Object.assign({
    context: dummyContext
  }, musicEntityBrowseEndpoint)

  return request({
    method: 'POST',
    url: entityUrl,
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

function indexPayloads (entity) {
  const index = {}

  for (const payload of entity.payload.payloads) {
    for (const key of Object.keys(payload)) {
      const item = payload[key]
      index[key] = index[key] || {}
      index[key][item.id] = item
      index[item.id] = item
    }
  }

  return index
}

async function getAlbum (url) {
  const entity = await getEntity(url)
  const index = indexPayloads(entity)

  if (!index.albumRelease) {
    throw new Error('No album release found for this entity.')
  }

  const album = index.albumRelease[Object.keys(index.albumRelease)[0]]

  album.primaryArtists = album.primaryArtists.map(id => index[id])
  album.details = index[album.details]
  album.details.tracks = album.details.tracks.map(id => index[id])

  for (const track of album.details.tracks) {
    track.albumRelease = index[track.albumRelease]
  }

  return album
}

exports.getEntity = getEntity
exports.indexPayloads = indexPayloads
exports.getAlbum = getAlbum
