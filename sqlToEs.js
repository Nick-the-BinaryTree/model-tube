#!/usr/bin/env node

// Stored settings

let settings = {
  es_host: 'cideruconn_elasticsearch_1:9200',
  models_path: './packages/cider-back/models'
}

// ==========================================================================================================================

// Functionality

const config = newSettings => {
  settings.es_host = newSettings.es_host
  settings.models_path = newSettings.models_path
  console.log('Configuration updated. Very nice.')
}

const index = models => {
  let host = config.es_host
  let path = config.models_path
  let toIndex = []
  let completeCount = 0

  const elasticsearch = require('elasticsearch')
  const client = new elasticsearch.Client({
    host: host,
    log: 'error'
  })

  toIndex = models.length > 0 ? args : Object.keys(require(path)).slice(0, -2) // Last 2 items are Sequelize boilerplate

  toIndex.forEach(async name => {
    const model = require(path)[name]
    const lowerName = name.toLowerCase() // Lowercase required by ES

    try {
      // If no awaits, these will run out of order
      await client.indices.delete({ // Wipe current values
        index: lowerName
      })
      await client.indices.create({ // Needs to exist before adding
        index: lowerName
      })

      const models = await model.findAll()
      let data = []
      models.forEach(item => { // 2 JSON objects must be pushed for each model w/ ES bulk
        data.push({
          // Searching many indices w/ 1 type each has same performance as 1 index w/ many types
          index: {
            _index: lowerName,
            _type: lowerName,
            _id: item.id
          }
        })
        data.push(item.dataValues)
      })

      const response = await client.bulk({ body: data })

      let errorCount = 0
      response.items.forEach(item => {
        item.index && item.index.error && errorCount++
      })
      const numItems = data.length / 2 // Divide by 2 b/c pushed two objects for each single model in bulk
      console.log(`\nIndexed ${numItems - errorCount}/${numItems} ${name} items`)
    } catch (error) {
      console.log(`\nIssue with ${name} model`)
      console.log('Hit ctrl-c if frozen\n')
      console.log(error)
    }
    console.log(`${++completeCount}/${toIndex.length} total models complete`) // Note, increment takes place inline
    completeCount === toIndex.length && process.exit() // Doesn't automatically close when all complete
  })
}

const printUsage = () => {
  console.log('Usage:')
  console.log('\nConfiguration Command')
  console.log('sql-to-es config [Elasticsearch server address] [Sequelize models folder path]')
  console.log('Ex: sql-to-es config http://localhost:9200 ./models')
  console.log('\nIndex Command')
  console.log('sql-to-es index [optional: specific model names to index space-separated]')
  console.log('Ex: sql-to-es index Facility Resource')
  console.log('Note: Typing no specific models will index all models')
  console.log('Ex: sql-to-es index')
  console.log('\nFinal note: "c" and "i" can be used instead of "config" and "index"')
  console.log('\nHave fun!')
}

// ==========================================================================================================================
// Process command if being used as CLI

const args = process.argv.slice(2) // First two args are "node" and [filename]

if (args.length > 0) {
  if (args[0] === 'config' || args[0] === 'c') {
    config({es_host: args[1], models_path: args[2]})
  } else if (args[0] === 'index' || args[0] === 'i') {
    index(args.slice(1))
  } else {
    printUsage()
  }
} else {
  printUsage()
}

module.exports = { config, index }
