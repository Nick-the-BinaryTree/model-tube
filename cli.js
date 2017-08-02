#!/usr/bin/env node

const tube = require('./index')

const printConfigUsage = () => {
  console.log('\nConfiguration Command')
  console.log('tube config [Elasticsearch server address] [Sequelize models folder path]')
  console.log('Note: Models path is absolute from system root or relative from node_modules/tube')
  console.log('Ex: tube config http://localhost:9200 ../../models')
  console.log('You can also override the default ES index, "app_index":')
  console.log('tube config -i [new index name]')
  console.log('Shortcut: "c" can be used instead of "config"\n')
}

const printIndexUsage = () => {
  console.log('\nIndex Command')
  console.log('tube index [optional: specific model names to index space-separated]')
  console.log('Ex: tube index Facility Resource')
  console.log('Note: Typing no specific models will index all models')
  console.log('Ex: tube index')
  console.log('Shortcut: "i" can be used instead of "index"\n')
}

const printSearchUsage = () => {
  console.log('\nSearch Commands')
  console.log('\nThree ways to simple search all models')
  console.log('tube simpleSearch [search term] [optional: property to search]')
  console.log('tube search [search term] [optional: property to search]')
  console.log('tube ss [search term] [optional: property to search]')
  console.log('\nTwo ways to fuzzy search:')
  console.log('tube fuzzySearch [search term] [optional: model name] [optional: property]')
  console.log('tube fs [search term] [model name] [optional: property]')
  console.log('\nNotes:')
  console.log('-If no model name is provided, all models will be searched')
  console.log('-Also, if no property is provided, all properties will be searched')
  console.log('-Raw query has no command b/c typing JSON into a terminal is not optimal')
}

const printUsage = () => {
  printConfigUsage()
  printIndexUsage()
  console.log('\nTo learn about searching, type: tube help search')
}

const commands = async () => {
  if (process.argv.length > 2) { // CLI will have a third arg
    const args = process.argv.slice(2) // First two args are "node" and [filename]

    if (args.length > 0) {
      if ((args[0] === 'config' || args[0] === 'c') && args.length >= 2) {
        if (args[1] === '-i') {
          tube.config({es_index: args[2]})
        } else {
          tube.config({es_host: args[1], models_path: args[2]})
        }
      } else if (args[0] === 'index' || args[0] === 'i') {
        tube.index(args.slice(1))
      } else if (args[0] === 'simpleSearch' || args[0] === 'search' || args[0] === 'ss') {
        console.log(await tube.simpleSearch(...args.slice(1)))
      } else if (args[0] === 'fuzzySearch' || args[0] === 'fs') {
        console.log(await tube.fuzzySearch(...args.slice(1)))
      } else if (args[0] === 'help' && args.length > 1 && args[1] === 'search') {
        printSearchUsage()
      } else if (args[0] === 'testHooks') {
        tube.testHooks()
      } else {
        printUsage()
      }
    } else {
      printUsage()
    }
  }
}

commands()
