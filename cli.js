#!/usr/bin/env node

const tube = require('./index')

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
    } else if (args[0] === 'testHooks') {
      tube.testHooks()
    } else {
      tube.printUsage()
    }
  } else {
    tube.printUsage()
  }
}
