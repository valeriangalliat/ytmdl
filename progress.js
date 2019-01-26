const ProgressBar = require('ascii-progress')

const barDefaults = {
  width: 20,
  filled: '='
}

function pad (maxSize, text) {
  return ' '.repeat(maxSize - text.length) + text
}

function initProgress (tagMaxSizes = {}) {
  const bars = []

  function padTags (tags) {
    const padded = {}

    for (const key of Object.keys(tags)) {
      padded[key] = pad(tagMaxSizes[key], tags[key])
    }

    return padded
  }

  function repadAll () {
    for (const bar of bars) {
      bar.repad()
    }
  }

  function add (params) {
    const bar = new ProgressBar(Object.assign({}, barDefaults, params))
    const tags = {}
    const paddedTags = {}

    function update (current, total) {
      bar.current = current
      bar.total = total

      bar.compile(paddedTags)
      bar.snoop()
    }

    function repad () {
      Object.assign(paddedTags, padTags(tags))
    }

    function tag (name, value) {
      tags[name] = value

      if (!tagMaxSizes[name]) {
        tagMaxSizes[name] = value.length
        repadAll()
      } else if (value.length > tagMaxSizes[name]) {
        tagMaxSizes[name] = value.length
        repadAll()
      } else {
        repad()
      }
    }

    function reset () {
      bar.current = 0
      bar.total = 100
      bar.completed = false
      bar.start = new Date()
    }

    function setSchema (schema) {
      bar.setSchema(schema, paddedTags)
    }

    const publicBar = {
      update,
      repad,
      tag,
      reset,
      setSchema
    }

    bars.push(publicBar)

    return publicBar
  }

  return { add }
}

exports.initProgress = initProgress
