const elasticsearch = require('elasticsearch')

const arrayToObject = (arr) => { // Simple object from array for O(1) lookup
  let res = {}
  arr.forEach(item => {
    res[item] = true
  })
  return res
}

class ModelTube {
  constructor (initSettings) {
    this.settings = { // Defaults
      'es_host': 'http://localhost:9200',
      'es_index': 'app_index',
      'models_path': '../../models',
      'whitelist': {},
      'blacklist': {}
    }

    this.config = this.config.bind(this)
    this.updateWhiteOrBlackList = this.updateWhiteOrBlackList.bind(this)
    this.setEsClient = this.setEsClient.bind(this)
    this.setModels = this.setModels.bind(this)
    this.setHooks = this.setHooks.bind(this)
    this.removeHooks = this.removeHooks.bind(this)
    this.index = this.index.bind(this)
    this.standardEsQuery = this.standardEsQuery.bind(this)

    Object.keys(initSettings).forEach(changedSetting => (
      this.settings[changedSetting] = initSettings[changedSetting]
    ))
    this.config(this.settings)
  }

  config (settings) { // Can initialize or update settings
    if (settings.es_host) {
      this.settings.es_host = settings.es_host
      this.setEsClient()
    }
    console.log("After setting in config")
    console.log(this.esClient)
    const changedList = this.updateWhiteOrBlackList(settings)
    this.settings.models_path = settings.models_path || this.settings.models_path
    this.settings.es_index = settings.es_index || this.settings.es_index
    if (settings.models_path || settings.es_index || changedList) {
      this.setModels()
      this.removeHooks()
      this.setHooks()
      this.index()
    }
  }

  updateWhiteOrBlackList (newSettings) {
    let oldType = this.listType
    let isWhite = newSettings.whitelist && Object.getOwnPropertyNames(newSettings.whitelist).length > 0
    let isBlack = newSettings.blacklist && Object.getOwnPropertyNames(newSettings.blacklist).length > 0
    if (isWhite && isBlack) {
      throw Error('Cannot have both a whitelist and a blacklist')
    } else if (isWhite) {
      this.listType = 'white'
    } else if (isBlack) {
      this.listType = 'black'
    } else {
      this.listType = 'none'
    }
    if (this.listType === 'white') { // Would normally use set datatype, but that's not compatible with JSON
      const newWhite = arrayToObject(newSettings.whitelist)
      if (this.settings.whitelist === newWhite) {
        return false
      }
      this.settings.whitelist = newWhite
      this.settings.blacklist = {}
      return true
    } else if (this.listType === 'black') {
      const newBlack = arrayToObject(newSettings.blacklist)
      if (this.settings.blacklist === newBlack) {
        return false
      }
      this.settings.whitelist = {}
      this.settings.blacklist = newBlack
      return true
    } else {
      this.settings.whitelist = {}
      this.settings.blacklist = {}
    }
    return oldType === this.listType
  }

  setEsClient () {
    this.esClient = new elasticsearch.Client({
      host: this.settings.es_host,
      log: 'error'
    })
    console.log("After creating")
    console.log(this.esClient)
  }

  setModels () {
    this.db = require(this.settings.models_path)
    this.sequelize = this.db.sequelize // Instance of Sequelize
    this.Sequelize = this.db.Sequelize // Sequelize Class
    this.models = {}
    Object.keys(this.db).forEach(name => {
      if ((name !== 'sequelize' && name !== 'Sequelize') &&
          ((this.listType === 'white' && this.settings.whitelist[name]) ||
           (this.listType === 'black' && !this.settings.blacklist[name]) ||
           (this.listType === 'none'))) {
        this.models[name] = this.db[name]
      }
    })
  }

  setHooks () {
    console.log("Setting hooks, client is:")
    console.log(this.esClient)
    Object.keys(this.models).forEach(name => { // Iterate over keys array (model names)
      const model = this.models[name]          // b/c can't iterate over object easily
      model.afterSave('modelSave', async (modelRecord, options) => {
        const esQuery = this.standardEsQuery(name, modelRecord.id)
        const exists = await this.esClient.exists(esQuery)
        if (exists) {
          try {
            const esUpdateQuery = Object.assign(
              esQuery,
              { body: { doc: { modelRecord } } } // ES update syntax: doc replaces
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
      model.afterDestroy('modelDestroy', async (modelRecord, options) => {
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

  removeHooks () {
    Object.keys(this.db).forEach(name => { // Remove hooks from all models whether or not on a list
      if (name !== 'sequelize' && name !== 'Sequelize') {
        this.db[name].removeHook('afterSave', 'modelSave')
        this.db[name].removeHook('afterDestroy', 'modelDestroy')
      }
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
      console.log('\nIssue creating index ' + this.settings.es_index + '\n')
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
