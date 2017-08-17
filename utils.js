const arrayToObject = (arr) => { // Simple object from array for O(1) lookup while
  let res = {}                   // abiding to JSON not handling sets
  arr.forEach(item => {
    res[item] = true
  })
  return res
}

const log = (msg, logging) => logging && console.log(msg)

module.exports = { arrayToObject, log }
