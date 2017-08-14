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

  async resetIndex (index) {
    const esQuery = { index: index }
    const exists = await this.esClient.indices.exists(esQuery)
    if (exists) {
      await this.esClient.indices.delete(esQuery)
    }
    await this.esClient.indices.create(esQuery)
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
    const response = await this.esClient.bulk({ body: data })
    log(response, this.logSetting)
  }
}

const log = (msg, logging) => logging && console.log(msg)

module.exports = ESQueue
