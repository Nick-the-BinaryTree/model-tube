const elasticsearch = require('elasticsearch')
const ESQueue = require('./ESQueue')
const Search = require('./Search')
const { arrayToObject, log } = require('./utils')

class ModelTube {
  constructor (initSettings) {
    this.settings = { // Defaults
      'es_host': 'http://localhost:9200',
      'es_index': 'app_index',
      'models_path': '../../models', // Can pass in models path (meant for CLI)
      'models': null,                // or library of models (preferred)
      'auto_index': false,
      'whitelist': {},
      'blacklist': {},
      'logs': false
    }
    this.config = this.config.bind(this)
    this.updateWhiteOrBlackList = this.updateWhiteOrBlackList.bind(this)
    this.setEsClient = this.setEsClient.bind(this)
    this.setModels = this.setModels.bind(this)
    this.setHooks = this.setHooks.bind(this)
    this.createIndex = this.createIndex.bind(this)
    this.removeHooks = this.removeHooks.bind(this)
    this.resetIndex = this.resetIndex.bind(this)
    this.index = this.index.bind(this)
    this.clearTypes = this.clearTypes.bind(this)
    this.genEsQuery = this.genEsQuery.bind(this)

    if (initSettings) {
      Object.keys(initSettings).forEach(changedSetting => (
        this.settings[changedSetting] = initSettings[changedSetting]
      ))
    }
    this.config(this.settings)
  }

  config (settings) { // Can initialize or update settings
    if (settings.es_host) {
      this.settings.es_host = settings.es_host
      this.setEsClient()
      if (this.esQueue) {
        this.esQueue.changeClient(this.esClient)
        this.search.changeClient(this.esClient)
      } else {
        this.esQueue = new ESQueue(this.esClient)
        this.search = new Search(this.esClient)
      }
    }
    const changedList = this.updateWhiteOrBlackList(settings)
    this.settings.models_path = settings.models_path || this.settings.models_path

    if (settings.es_index) {
      this.settings.es_index = settings.es_index
      this.search.changeIndexSetting(settings.es_index)
    }

    if (settings.logs) {
      this.settings.logs = settings.logs
      this.esQueue.changeLogSetting(settings.logs)
    }

    if (settings.models_path || settings.es_index || changedList) {
      this.setModels()
      this.removeHooks()
      this.setHooks()
      if (this.settings.auto_index) {
        this.index()
      }
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
      this.settings.blacklist = newBlack
      this.settings.whitelist = {}
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
  }

  setModels () {
    this.db = this.settings.models || require(this.settings.models_path)
    this.sequelize = this.db.sequelize
    this.Sequelize = this.db.Sequelize
    this.models = {}
    Object.keys(this.db).forEach(name => {
      if ((name !== 'sequelize' && name !== 'Sequelize') &&
          ((this.settings.whitelist[name] && !this.settings.blacklist[name]) ||
           (this.listType === 'none'))) {
        this.models[name] = this.db[name]
      }
    })
  }

  setHooks () {
    Object.keys(this.models).forEach(name => {
      const model = this.models[name]
      model.afterSave('modelSave', async (modelRecord, options) => {
        this.esQueue.add('index', this.genEsQuery(name, modelRecord.id), modelRecord)
      })
      model.afterDestroy('modelDestroy', async (modelRecord, options) => {
        this.esQueue.add('delete', this.genEsQuery(name, modelRecord.id))
      })
    })
  }

  removeHooks () {
    Object.keys(this.db).forEach(name => { // Remove hooks from all models whether or not on a list
      if (name !== 'sequelize' && name !== 'Sequelize') { // b/c we don't want unwanted hooks firing
        this.db[name].removeHook('afterSave', 'modelSave')
        this.db[name].removeHook('afterDestroy', 'modelDestroy')
      }
    })
  }

  async createIndex () {
    const esQuery = { index: this.settings.es_index }
    const exists = await this.esClient.indices.exists(esQuery)
    if (!exists) {
      await this.esClient.indices.create(esQuery)
    }
  }

  async resetIndex () {
    await this.esQueue.add('resetIndex', this.settings.es_index)
  }

  async index (modelArgs) {
    await this.resetIndex()

    let toIndex = []
    let completeCount = 0

    if (modelArgs && modelArgs.length > 0) {
      await this.clearTypes(modelArgs)
      toIndex = modelArgs
    } else {
      await this.resetIndex()
      toIndex = Object.keys(this.models)
    }

    toIndex.forEach(async name => {
      const model = this.models[name]
      const modelInstances = await model.findAll()
      modelInstances.forEach(item => {
        this.esQueue.add('index', this.genEsQuery(name, item.id), item.dataValues)
      })
      log(`${++completeCount}/${toIndex.length} total models complete`, this.settings.logs)
    })
  }

  async clearTypes (types) {
    types.forEach(async type => {
      await this.esClient.deleteByQuery({
        index: this.settings.es_index,
        type: type
      })
    })
  }

  async simpleSearch (searchTerm, propertyToSearch) {
    return this.search.simpleSearch(searchTerm, propertyToSearch)
  }

  async fuzzySearch (searchTerm, modelName, propertyToSearch, idOnly) {
    return this.search.fuzzySearch(searchTerm, modelName, propertyToSearch, idOnly)
  }

  async rawQuery (queryJSON) {
    return this.search.rawQuery(queryJSON)
  }

  genEsQuery (name, id) {
    return {
      _index: this.settings.es_index,
      _type: name.toLowerCase(),
      _id: id
    }
  }
}

module.exports = initSettings => new ModelTube(initSettings)
