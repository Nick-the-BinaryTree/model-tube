module.exports = (sequelize, DataTypes) => {
  const Vegetable = sequelize.define('Vegetable', {
    name: DataTypes.STRING
  })
  return Vegetable
}
