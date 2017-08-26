'use strict'
const db = require('../models')
module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('Fruits', db['Fruit'].attributes).then(() =>
      queryInterface.createTable('Vegetables', db['Vegetable'].attributes))
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropAllTables()
  }
}
