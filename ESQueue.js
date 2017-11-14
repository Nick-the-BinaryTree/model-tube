const debounce = require('lodash.debounce')

class ESQueue {
  constructor (esClient, logSetting) {
    this.q = []
    this.esClient = esClient
    this.logSetting = logSetting

    this.add = this.add.bind(this)
    this.bulkQ = this.bulkQ.bind(this)
    this.resetIndex = this.resetIndex.bind(this)
    this.changeClient = this.changeClient.bind(this)
    this.changeLogSetting = this.changeLogSetting.bind(this)

    this.debouncedBulkQ = debounce(this.bulkQ, 2000)
  }

  changeClient (newClient) {
    this.esClient = newClient
  }

  changeLogSetting (logSetting) {
    this.logSetting = logSetting
  }

  add (type, esQuery, doc) {
    if (type === 'resetIndex') {
      this.q = []
      return this.resetIndex(esQuery)
    }
    this.q.push({ type: type, esQuery: esQuery, doc: doc })
    this.debouncedBulkQ()
  }

  async resetIndex (index, attempt = 1) {
    const esQuery = { index: index }
    try {
      const exists = await this.esClient.indices.exists(esQuery)
      if (exists) {
        await this.esClient.indices.delete(esQuery)
      }
      await this.esClient.indices.create(esQuery)
    } catch (error) {
      if (attempt <= 5) {
        console.error('\nElasticsearch probably not ready yet.')
        console.error('Retry attempt ' + attempt + '/5\n')
        setTimeout(() => this.resetIndex(index, attempt + 1), 3000)
      } else {
        console.error(error)
      }
    }
  }

  async bulkQ () {
    if (this.q.length === 0) {
      return
    }
    let data = []
    this.q.forEach((action) => {
      let bulkItem = {}
      bulkItem[action.type] = action.esQuery
      data.push(bulkItem)
      if (action.type !== 'delete') { // Delete does not take another bulk argument
        data.push(action.doc)
      }
    })
    this.q = []
    await this.esClient.bulk({ body: data })
  }
}

module.exports = ESQueue
