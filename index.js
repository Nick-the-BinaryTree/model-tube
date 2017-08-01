#!/usr/bin/env node
// ==========================================================================================================================
// Globals

let settingsPath = null
let settings = null
let client = null

// ==========================================================================================================================
// Import settings, create Elasticsearch client, and add sequelize hooks

const setup = () => {
  const thisPath = require('path')
  const settingsPath = thisPath.join(__dirname, '/settings.json')
  try {
    settings = require(settingsPath)
    const elasticsearch = require('elasticsearch')
    client = new elasticsearch.Client({
      host: settings.es_host,
      log: 'error'
    })
  } catch (error) {
    console.log('\nPlease configure settings')
    console.log('tube config [Elasticsearch server address] [Sequelize models folder path]\n')
    console.log(error)
    return
  }
  try {
    const toHook = Object.keys(require(settings.models_path)).slice(0, -2)
    toHook.forEach(name => {
      const model = require(settings.models_path)[name]
      model.hook('afterSave', (_model, options) => {
        console.log('Save hook fired')
      })
      model.hook('afterDestroy', (_model, options) => {
        console.log('Destroy hook fired')
      })
    })
  } catch (error) {
    console.log('\nError setting up Sequelize hooks\n')
    console.log(error)
  }
}

// ==========================================================================================================================
// Functionality

const config = newSettings => {
  const fs = require('fs')
  settings.es_host = newSettings.es_host || settings.es_host // Copy over new relevant settings or keep old
  settings.models_path = newSettings.models_path || settings.models_path
  settings.es_index = newSettings.es_index || settings.es_index
  fs.writeFile(settingsPath, JSON.stringify(settings), () => {
    console.log('Configuration updated. Very nice.')
  })
}

const index = async models => {
  try {
    // If no awaits, these will run out of order
    await client.indices.delete({ // Wipe current values
      index: settings.es_index
    })
  } catch (error) {
    console.log(error)
    console.log('\nGoing to try creating new index: ' + settings.es_index + '\n')
  }
  try {
    await client.indices.create({
      index: settings.es_index
    })
  } catch (error) {
    console.log('\nIssue deleting index\n')
    console.log(error)
    return
  }

  let toIndex = []
  let completeCount = 0

  toIndex = models && models.length > 0
    ? models // Last 2 items are Sequelize boilerplate
    : Object.keys(require(settings.models_path)).slice(0, -2)

  toIndex.forEach(async name => {
    const model = require(settings.models_path)[name]

    try {
      const models = await model.findAll()
      let data = []
      models.forEach(item => { // 2 JSON objects must be pushed for each model w/ ES bulk
        data.push({
          // Searching many indices w/ 1 type each has same performance as 1 index w/ many types
          index: {
            _index: settings.es_index,
            _type: name.toLowerCase(), // Lowercase required by ES
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

const testHooks = async () => {
  const Order = require(settings.models_path)['Order']
  await Order.create({
    id: 17,
    submittingUserId: 1,
    request: '{ "good day": "tortoise" }',
    createdAt: new Date(),
    updatedAt: new Date()})
  let testOrder = await Order.findById(17)
  testOrder.request = '{ "good day": "pinata" }'
  await testOrder.save()
  testOrder.destroy()
}

const printUsage = () => {
  console.log('Usage:')
  console.log('\nConfiguration Command')
  console.log('tube config [Elasticsearch server address] [Sequelize models folder path]')
  console.log('Note: Models path is absolute from system root or relative from node_modules/tube')
  console.log('Ex: tube config http://localhost:9200 ../../models')
  console.log('You can also override the default ES index, "app_index":')
  console.log('tube config -i [new index name]')
  console.log('\nIndex Command')
  console.log('tube index [optional: specific model names to index space-separated]')
  console.log('Ex: tube index Facility Resource')
  console.log('Note: Typing no specific models will index all models')
  console.log('Ex: tube index')
  console.log('\nFinal note: "c" and "i" can be used instead of "config" and "index"')
  console.log('\nHave fun!')
}

// ==========================================================================================================================
// Process command if being used as CLI

setup()

if (process.argv.length > 2) { // CLI will have a third arg
  const args = process.argv.slice(2) // First two args are "node" and [filename]

  if (args.length > 0) {
    if ((args[0] === 'config' || args[0] === 'c') && args.length >= 2) {
      if (args[1] === '-i') {
        config({es_index: args[2]})
      } else {
        config({es_host: args[1], models_path: args[2]})
      }
    } else if (args[0] === 'index' || args[0] === 'i') {
      index(args.slice(1))
    } else if (args[0] === 'testHooks') {
      testHooks()
    } else {
      printUsage()
    }
  } else {
    printUsage()
  }
}

module.exports = { config, index }
