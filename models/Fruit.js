module.exports = (sequelize, DataTypes) => {
  const Fruit = sequelize.define('Fruit', {
    name: DataTypes.STRING
  })
  return Fruit
}
