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
    this.testHooks = this.testHooks.bind(this)

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
      console.log(error)
      return
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
          console.log('\nResult exists?: ' + exists + '\n')

          if (exists) {
            try {
              const esUpdateQuery = Object.assign(
                esQuery,
                { body: { doc: { _model } } }
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
      console.log('\nIssue creating index\n')
      console.log(error)
      return
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
            // Searching many indices w/ 1 type each has same performance as 1 index w/ many types
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

  printUsage () {
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

  standardEsQuery (name, id) {
    return {
      index: this.settings.es_index,
      type: name.toLowerCase(),
      id: id
    }
  }

  async testHooks () {
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
module.exports = ModelTube
