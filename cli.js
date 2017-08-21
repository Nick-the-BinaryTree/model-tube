#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const settingsPath = path.join(__dirname, '/settings.json')

// Since this file is reloaded on each command, we read and wrtie settings to a file
const tube = require('./index')(require(settingsPath))

const printConfigUsage = () => {
  console.log('\nConfiguration Command')
  console.log('tube config [Elasticsearch server address] [Sequelize models folder path]')
  console.log('Note: Models path is absolute from system root or relative from node_modules/tube')
  console.log('Ex: tube config http://localhost:9200 ../../models')
  console.log('You can also override the default ES index, "app_index":')
  console.log('tube config -i [new index name]')
  console.log('Or you can set a whitelist or blacklist of models to hook and index:')
  console.log('tube config [-wl or -bl] [space-separated model names]')
  console.log('Ex: tube config -wl Facility Resource')
  console.log('Type "tube config" without any arguments to view current settings')
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

const printResetUsage = () => {
  console.log('\nReset Command')
  console.log('tube reset')
  console.log('Wipes Elasticsearch index in settings (careful!)\n')
}

const printCreateIndexUsage = () => {
  console.log('\nCreate Command')
  console.log('tube create')
  console.log('Creates a blank index with the name specified in setting')
  console.log('Note: The above will do nothing if the index already exists\n')
}

const printClearTypesUsage = () => {
  console.log('\nClear Types Command')
  console.log('tube clearTypes [model names (space-separated)]')
  console.log('Removes all models with the name specified from the index.')
  console.log('Ex: tube clearTypes Resource Facility Order')
  console.log('Shortcut: "ct" can be used instead of "clearTypes"\n')
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

const printHelp = () => {
  printConfigUsage()
  printIndexUsage()
  console.log('\nTo learn about searching, type: tube help search\n')
  console.log('\nFor more commands, type: tube help 2\n')
}

const printHelp2 = () => {
  printResetUsage()
  printCreateIndexUsage()
  printClearTypesUsage()
}

const commands = async () => {
  if (process.argv.length <= 2) {
    printHelp()
    return
  }
  const [command, ...args] = process.argv.slice(2) // First two args are "node" and [filename]
  if ((command === 'config' || command === 'c') && args.length >= 1) {
    if (args[0] === '-i') {
      tube.config({es_index: args[1]})
    } else if (args[0] === '-wl') {
      tube.config({whitelist: args.slice(1)})
    } else if (args[0] === '-bl') {
      tube.config({blacklist: args.slice(1)})
    } else {
      tube.config({es_host: args[0], models_path: args[1]})
    }
    fs.writeFile(settingsPath, JSON.stringify(tube.settings))
  } else if (command === 'config' || command === 'c') {
    console.log(tube.settings)
  } else if (command === 'index' || command === 'i') {
    tube.index(args)
  } else if (command === 'reset') {
    tube.resetIndex()
  } else if (command === 'create') {
    tube.clearTypes(args)
  } else if (command === 'clearTypes') {
    tube.resetIndex()
  } else if (command === 'simpleSearch' || command === 'search' || command === 'ss') {
    console.log(await tube.simpleSearch(...args))
  } else if (command === 'fuzzySearch' || command === 'fs') {
    console.log(await tube.fuzzySearch(...args))
  } else if (command === 'help') {
    if (!args || args[0] === '1') {
      printHelp()
    }
    if (args[0] === 'search') {
      printSearchUsage()
    } else if (args[0] === '2') {
      printHelp2()
    } else {
      printHelp()
    }
  }
}

commands()
