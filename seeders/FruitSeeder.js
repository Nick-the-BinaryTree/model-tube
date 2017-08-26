const faker = require('faker')

module.exports = {
  up: async (queryInterface, Sequelize) => (
    queryInterface.bulkInsert('Fruits', [...Array(5)].map(() => ({
      name: faker.name.lastName()
    })), {})
  ),

  down: (queryInterface, Sequelize) => (
    queryInterface.bulkDelete('Fruits', null, {})
  )
}
