/* eslint-env jest */

const db = require('./models')

beforeAll(async () => {
  await db.sequelize.sync({ force: true })
  db.sequelize.close
})
