const elasticsearch = require('elasticsearch')
const fs = require('fs')
const pathToHere = require('path')

class ModelTube {
  constructor () {
    this.settingsPath = null
    this.settings = null
    this.esClient = null
    this.modelNames = null
    this.modelObjects = null

    this.setup = this.setup.bind(this)
    this.config = this.config.bind(this)
    this.index = this.index.bind(this)
    this.standardEsQuery = this.standardEsQuery.bind(this)
    this.testHooks = this.testHooks.bind(this) // TODO: Remove in final release

    this.setup()
  }

  setup () {
    this.settingsPath = pathToHere.join(__dirname, '/settings.json')
    try {
      this.settings = require(this.settingsPath)
      this.esClient = new elasticsearch.Client({
        host: this.settings.es_host,
        log: 'error'
      })
    } catch (error) {
      console.log('\nPlease configure settings')
      console.log('tube config [Elasticsearch server address] [Sequelize models folder path]\n')
      throw error
    }
    try {
      this.modelObjects = require(this.settings.models_path)
      this.modelNames = Object.keys(this.modelObjects).slice(0, -2) // Last 2 items are Sequelize boilerplate
      this.modelNames.forEach(name => {
        const model = this.modelObjects[name]
        model.hook('afterSave', async (_model, options) => {
          const esQuery = this.standardEsQuery(name, _model.id)
          console.log(esQuery)
          let exists = null
          try {
            exists = await this.esClient.exists(esQuery)
          } catch (error) {
            console.log('\nError checking if model doc exists in ES\n')
            console.log(error)
          }

          if (exists) {
            try {
              const esUpdateQuery = Object.assign(
                esQuery,
                { body: { doc: { _model } } } // Update syntax: doc replaces
              )
              await this.esClient.update(esUpdateQuery)
            } catch (error) {
              console.log('\nError updating ES doc in save hook\n')
              console.log(error)
            }
          } else if (exists === false) { // Might be null
            try {
              const esCreateQuery = Object.assign(
                esQuery,
                { body: _model }
              )
              await this.esClient.create(esCreateQuery)
            } catch (error) {
              console.log('\nError creating ES doc in save hook\n')
              console.log(error)
            }
          }
        })
        model.hook('afterDestroy', async (_model, options) => {
          const esQuery = this.standardEsQuery(name, _model.id)
          try {
            await this.esClient.delete(esQuery)
          } catch (error) {
            console.log('\nError with destroy hook\n')
            console.log(error)
          }
        })
      })
    } catch (error) {
      console.log('\nError setting up Sequelize hooks\n')
      console.log(error)
    }
  }

  config (newSettings) {
    this.settings.es_host = newSettings.es_host || this.settings.es_host // Copy over new relevant settings or keep old
    this.settings.models_path = newSettings.models_path || this.settings.models_path
    this.settings.es_index = newSettings.es_index || this.settings.es_index
    fs.writeFile(this.settingsPath, JSON.stringify(this.settings), () => {
      console.log('Configuration updated. Very nice.')
    })
  }

  async index (modelArgs) {
    try {
      // If no awaits, these will run out of order
      await this.esClient.indices.delete({ // Wipe current values
        index: this.settings.es_index
      })
    } catch (error) {
      console.log(error)
      console.log('\nGoing to try creating new index: ' + this.settings.es_index + '\n')
    }
    try {
      await this.esClient.indices.create({
        index: this.settings.es_index
      })
    } catch (error) {
      console.log('\nIssue creating index ' + this.settings.ex_index + '\n')
      throw error
    }

    let toIndex = []
    let completeCount = 0

    toIndex = modelArgs && modelArgs.length > 0
      ? modelArgs
      : this.modelNames

    toIndex.forEach(async name => {
      const model = this.modelObjects[name]
      try {
        const modelInstances = await model.findAll()
        let data = []
        modelInstances.forEach(item => { // 2 JSON objects must be pushed for each model w/ ES bulk
          data.push({
            index: {
              _index: this.settings.es_index,
              _type: name.toLowerCase(), // Lowercase required by ES
              _id: item.id
            }
          })
          data.push(item.dataValues)
        })
        const response = await this.esClient.bulk({ body: data })

        let errorCount = 0
        response.items.forEach(item => {
          item.index && item.index.error && errorCount++
        })
        const numItems = data.length / 2 // Divide by 2 b/c pushed two objects for each single model in bulk
        console.log(`\nIndexed ${numItems - errorCount}/${numItems} ${name} items`)
      } catch (error) {
        console.log(`\nIssue with ${name} model\n`)
        console.log(error)
      }
      console.log(`${++completeCount}/${toIndex.length} total models complete`) // Note, increment takes place inline
      completeCount === toIndex.length && process.exit() // Doesn't automatically close when all complete
    })
  }

  async simpleSearch (searchTerm, propertyToSearch) {
    propertyToSearch = propertyToSearch || '_all' // If not property to search provided, search all fields
    try {
      const results = await this.esClient.search({
        index: this.settings.es_index,
        q: propertyToSearch + ':' + searchTerm
      })
      return results.hits.hits
    } catch (error) {
      console.log(error)
    }
  }

  async fuzzySearch (searchTerm, modelName, propertyToSearch) {
    let searchQuery = {
      index: 'app_index',
      body: {
        query: {
          match: {}
        }
      }
    }
    propertyToSearch = propertyToSearch || '_all'
    searchQuery.body.query.match[propertyToSearch] = {
      query: searchTerm, // Set inner fuzzy query to search term
      fuzziness: 'AUTO'
    }
    if (modelName) { // If no model to search provided (type), search all models
      searchQuery['type'] = modelName.toLowerCase()
    }
    try {
      const results = await this.esClient.search(searchQuery)
      return results.hits.hits
    } catch (error) {
      console.log(error)
    }
  }

  async rawQuery (queryJSON) {
    try {
      const results = await this.esClient.search(queryJSON)
      return results.hits.hits
    } catch (error) {
      console.log(error)
    }
  }

  standardEsQuery (name, id) {
    return {
      index: this.settings.es_index,
      type: name.toLowerCase(),
      id: id
    }
  }

  async testHooks () { // TODO: Remove in official release
    const Order = this.modelObjects['Order']
    await Order.create({
      id: 51,
      submittingUserId: 1,
      request: '{ "good day": "tortoise" }',
      createdAt: new Date(),
      updatedAt: new Date()})
    console.log('\nSequelize Created\n')
    let testOrder = await Order.findById(51)
    testOrder.request = '{ "good day": "pinata" }'
    await testOrder.save()
    console.log('\nSequelize Saved\n')
    await testOrder.destroy()
    console.log('\nSequelize Destroyed\n')
  }
}
module.exports = new ModelTube()
