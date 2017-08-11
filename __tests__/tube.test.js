/* eslint-env jest */

const tube = require('../index')({models_path: './__tests__/models'})

it('initialize tube', () => {
  expect.assertions(3)
  expect(tube).toBeDefined()
  expect(tube.esClient).toBeDefined()
  expect(tube.models).toBeDefined()
})

// async test () {
//   const Fruit = this.sequelize.define('Fruit', {
//     name: this.Sequelize.STRING
//   })
//
//   let db = require(this.settings.models_path)
//   this.models[Fruit.name] = Fruit
//   console.log(this.models)
//   db[Fruit.name] = Fruit
//   await db.sequelize.sync()
//
//   await Fruit.create({
//     name: 'Lemon'
//   })
//   console.log('\nSequelize record was created\n')
//
//   const esQuery = this.standardEsQuery('Fruit', 1)
//   let exists = await this.esClient.exists(esQuery)
//   console.log('ES document created? ' + exists)
//
//   let testModel = await Fruit.findById(1)
//   testModel.name = 'Banana'
//   await testModel.save()
//   console.log('\nSequelize record was saved\n')
//
//   let foundDocument = await this.esClient.get(esQuery)
//   console.log('ES document altered? ' + foundDocument.name === 'Banana')
//
//   await testModel.destroy()
//   console.log('\nSequelize record was destroyed\n')
//
//   exists = await this.esClient.exists(esQuery)
//   console.log('ES document destroyed? ' + exists)
//
//   delete db[Fruit.name]
//   db.sequelize.sync()
// }
