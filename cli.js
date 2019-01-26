const { docopt } = require('docopt')

const { version } = require('./package')
const ytmdl = require('./')

const doc = `
Usage: ytmdl <url>
`.trim()

module.exports = function cli (argv, exit = false) {
  const args = docopt(doc, { argv, version, exit })

  ytmdl.fetchAlbum(args['<url>'])
}
