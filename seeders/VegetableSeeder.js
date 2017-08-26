const faker = require('faker')

module.exports = {
  up: async (queryInterface, Sequelize) => (
    queryInterface.bulkInsert('Vegetables', [...Array(5)].map(() => ({
      name: faker.name.firstName()
    })), {})
  ),

  down: (queryInterface, Sequelize) => (
    queryInterface.bulkDelete('Vegetables', null, {})
  )
}
