class Search {
  constructor (esClient, indexSetting) {
    this.esClient = esClient
    this.indexSetting = indexSetting

    this.changeClient = this.changeClient.bind(this)
    this.changeIndexSetting = this.changeIndexSetting.bind(this)
    this.simpleSearch = this.simpleSearch.bind(this)
    this.fuzzySearch = this.fuzzySearch.bind(this)
    this.rawQuery = this.rawQuery.bind(this)
  }

  changeClient (newClient) {
    this.esClient = newClient
  }

  changeIndexSetting (newIndex) {
    this.indexSetting = newIndex
  }

  async simpleSearch (searchTerm, propertyToSearch) {
    propertyToSearch = propertyToSearch || '_all'
    const results = await this.esClient.search({
      index: this.indexSetting,
      q: propertyToSearch + ':' + searchTerm
    })
    return results.hits.hits
  }

  async fuzzySearch (searchTerm, modelName, propertyToSearch) {
    let searchQuery = {
      index: this.indexSetting,
      body: {
        query: {
          match: {}
        }
      }
    }
    propertyToSearch = propertyToSearch || '_all'
    searchQuery.body.query.match[propertyToSearch] = {
      query: searchTerm,
      fuzziness: 'AUTO'
    }
    if (modelName) {
      searchQuery['type'] = modelName.toLowerCase()
    }
    const results = await this.esClient.search(searchQuery)
    return results.hits.hits
  }

  async rawQuery (queryJSON) {
    const results = await this.esClient.search(queryJSON)
    return results.hits.hits
  }
}

module.exports = Search
