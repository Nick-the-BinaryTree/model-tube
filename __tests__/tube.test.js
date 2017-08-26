/* eslint-env jest */

const tube = require('../index')({models_path: './models'})
const db = require('../models')
const Fruit = db['Fruit']
const Vegetables = db['Vegetables']

it('initialize tube', () => {
  expect.assertions(5)
  expect(tube).toBeDefined()
  expect(tube.esClient).toBeDefined()
  expect(tube.models).toBeDefined()
  expect(tube.esQueue).toBeDefined()
  expect(tube.search).toBeDefined()
})

// Test automatic hooks by creating, modifying, and deleting a Sequelize model
// and seeing if the corresponding Elasticsearch document reflects the changes.
it('has working hooks', async () => {
  // expect.assertions(3)
  await Fruit.create({
    id: 1000,
    name: 'Lemon'
  })

  const esQuery = {
    index: tube.settings.es_index,
    type: 'fruit',
    id: 1000
  }
  let exists = await this.esClient.exists(esQuery)
  expect(exists).toBe(true)

  // let testModel = await Fruit.findById(1000)
  // testModel.name = 'Banana'
  // await testModel.save()
  // console.log('\nSequelize record was saved\n')
  //
  // let foundDocument = await this.esClient.get(esQuery)
  // console.log('ES document altered? ' + foundDocument.name === 'Banana')
  // expect(foundDocument.name).toBe('Banana')
  //
  // await testModel.destroy()
  // console.log('\nSequelize record was destroyed\n')
  //
  // exists = await this.esClient.exists(esQuery)
  // console.log('ES document destroyed? ' + exists)
  // expect(exists).toBe(false)
})

// Test the config by editing settings and then reading them to check for the alterations.

// Test index command by creating data, manually deleting the Elasticsearch documents automatically created for it by the hooks, and then running index to add it back.

// Test clearTypes by clearing a type and then confirming it cannot be searched.

// Test simple search by checking to see if Elasticsearch documents meeting the search criteria show up across multiple data and fields. Also test an optional property to search.

// Test fuzzy search similarly to the above but add slight misspellings. Test: only a search term, search term and model name, search term and property name, and, lastly, search term, model name, and property name.

// Test raw query. Doesn't have to be too complicated, just make sure that the package can take our raw Elasticsearch query JSON and produce results.

// Test that hooks only attach to items on an optional whitelist by querying Elasticsearch for items on and off the list.

// Test that hooks only attach to items on an optional blacklist by querying Elasticsearch for items on and off the list.
