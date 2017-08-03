const elasticsearch = require('elasticsearch')
const fs = require('fs')
const pathToHere = require('path')

class ModelTube {
  constructor (initSettings) {
    this.settingsPath = pathToHere.join(__dirname, '/settings.json')
    this.settings = require(this.settingsPath)

    this.initConfig = this.initConfig.bind(this)
    this.updateConfig = this.updateConfig.bind(this)
    this.setEsClient = this.setEsClient.bind(this)
    this.setModels = this.setModels.bind(this)
    this.setHooks = this.setHooks.bind(this)
    this.index = this.index.bind(this)
    this.standardEsQuery = this.standardEsQuery.bind(this)

    if (initSettings) {
      this.initConfig(initSettings)
    }
    this.setEsClient()
    this.setModels()
    this.setHooks()
  }

  initConfig (newSettings) {
    this.settings.es_host = newSettings.es_host || this.settings.es_host
    this.settings.models_path = newSettings.models_path || this.settings.models_path
    this.settings.es_index = newSettings.es_index || this.settings.es_index
    fs.writeFile(this.settingsPath, JSON.stringify(this.settings))
  }

  updateConfig (newSettings) {
    if (newSettings.es_host) {
      this.settings.es_host = newSettings.es_host
      this.setEsClient()
    }
    if (newSettings.models_path) {
      this.settings.models_path = newSettings.models_path
      this.setModels()
    }
    if (newSettings.es_index) {
      this.settings.es_index = newSettings.es_index
      this.setHooks()
    }
    fs.writeFile(this.settingsPath, JSON.stringify(this.settings))
  }

  setEsClient () {
    this.esClient = new elasticsearch.Client({
      host: this.settings.es_host,
      log: 'error'
    })
  }

  setModels () {
    let db = require(this.settings.models_path)
    this.sequelize = db.sequelize // Instance of Sequelize
    this.Sequelize = db.Sequelize // Sequelize Class
    this.models = {}
    Object.keys(db).forEach(name => { // Delete syntax unfortunately deletes for test too, so we pseudo-filter
      if (name !== 'sequelize' && name !== 'Sequelize') {
        this.models[name] = db[name]
      }
    })
  }

  setHooks () {
    Object.keys(this.models).forEach(name => { // Iterate over keys array (model names)
      const model = this.models[name]          // b/c can't iterate over object easily
      model.hook('afterSave', async (modelRecord, options) => {
        const esQuery = this.standardEsQuery(name, modelRecord.id)
        const exists = await this.esClient.exists(esQuery)
        if (exists) {
          try {
            const esUpdateQuery = Object.assign(
              esQuery,
              { body: { doc: { modelRecord } } } // Update syntax: doc replaces
            )
            await this.esClient.update(esUpdateQuery)
          } catch (error) {
            console.log('\nError updating ES doc in save hook\n')
            throw error
          }
        } else {
          try {
            const esCreateQuery = Object.assign(
              esQuery,
              { body: modelRecord }
            )
            await this.esClient.create(esCreateQuery)
          } catch (error) {
            console.log('\nError creating ES doc in save hook\n')
            throw error
          }
        }
      })
      model.hook('afterDestroy', async (modelRecord, options) => {
        const esQuery = this.standardEsQuery(name, modelRecord.id)
        try {
          await this.esClient.delete(esQuery)
        } catch (error) {
          console.log('\nError with destroy hook\n')
          throw error
        }
      })
    })
  }

  async index (modelArgs) {
    try {
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
      : Object.keys(this.models)

    toIndex.forEach(async name => {
      const model = this.models[name]
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
    const results = await this.esClient.search({
      index: this.settings.es_index,
      q: propertyToSearch + ':' + searchTerm
    })
    return results.hits.hits
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
    const results = await this.esClient.search(searchQuery)
    return results.hits.hits
  }

  async rawQuery (queryJSON) {
    const results = await this.esClient.search(queryJSON)
    return results.hits.hits
  }

  standardEsQuery (name, id) {
    return {
      index: this.settings.es_index,
      type: name.toLowerCase(),
      id: id
    }
  }
}

module.exports = initSettings => new ModelTube(initSettings)
