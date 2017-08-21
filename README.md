# Model Tube
Index Sequelize models as Elasticsearch documents.


## Installation
Local to project (what you probably want):
`npm install https://github.com/Nick-the-BinaryTree/model-tube`

Global (to use CLI anywhere without npx):
`npm install -g  https://github.com/Nick-the-BinaryTree/model-tube`


## CLI Usage
There are two ways to use this package. They are both fabulous.

The first is as a CLI tool.

If you did a global install, you can run this package's commands anywhere in a terminal like so:

`tube [command]`

If you did a local install, make sure you're in your project directory and just add `npx` to the front:

`npx tube [command]`

`npx` is built into the latest version of npm or can be downloaded separately.

### Configuration Command
`tube config [Elasticsearch server address] [Sequelize models folder path]`

Note: Models path is absolute from system root or relative from `node_modules/tube`

Ex: `tube config http://localhost:9200 ../../models`

You can also override the default ES index, "app_index":
`tube config -i [new index name]`

Shortcut: `c` can be used instead of `config`

### Index Command
`tube index [optional: specific model names to index space-separated]`

Ex: `tube index Facility Resource`

Note: Typing no specific models will index all models.

Ex: `tube index`

Shortcut: `i` can be used instead of `index`

### Reset Command
`tube reset`

Wipes Elasticsearch index in settings (careful!).

### Create Command
`tube create`

Creates a blank index with the name specified in setting.
Note: The above will do nothing if the index already exists.

### Clear Types Command
`tube clearTypes [model names (space-separated)]'``

Removes all models with the name specified from the index.

Ex: `tube clearTypes Resource Facility Order`

'Shortcut: "ct" can be used instead of "clearTypes"

### Search Commands
Three ways to simple search all models:
`tube simpleSearch [search term] [optional: property to search]`
`tube search [search term] [optional: property to search]`
`tube ss [search term] [optional: property to search]`

Two ways to fuzzy search:
`tube fuzzySearch [search term] [optional: model name] [optional: property]`
`tube fs [search term] [model name] [optional: property]`

Notes:
* If no model name is provided, all models will be searched.
* Also, if no property is provided, all properties will be searched.
* Raw query has no command b/c typing JSON into a terminal is not optimal.

## "In-Code" Usage
If you want to use model-tube functionalities in your code, you can import them as follows:

`const tube = require('model-tube')()`

If the default settings in `settings.json` are not to your liking, you can configure them on the import with:

`const tube = require('model-tube')({ es_host: YOUR_SERVER, es_index: YOUR_INDEX, models: YOUR_MODELS })`

Note: You only have to enter the JSON keys for settings you want to override. For instance, you could leave out `es_index` to keep the default `app_index`.

To update the settings anywhere in the code, run:

`tube.config({ NEW SETTINGS })`

Current settings:
* es_host: String starting with 'http://' and ending with a port (':9200'). Default: 'http://localhost:9200'
* es_index: String of the name of your desired Elasticsearch index. Default: 'app_index'
* models_path: String of relative file path to models. This is meant for the CLI, which has to find the models each run. Default: '../../models'
* models: `require` of the relative path to your models. This is preferred over the models_path setting. Ex: `{ models: require('../models') }` Default: `null`
* auto_index: Boolean deciding whether or not to automatically index all models on initialization of model-tube. Probably not a good idea in environments like `Jest` testing, which would initialize model-tube many times simultaneously. Default: `false`
* whitelist: Array of model names to whitelist for hooks and indexing. Default: `{}` (the arrays passed in are transformed into objects)
* blacklist: Array of model names to blacklist for hooks and indexing. Default: `{}`
* logs: Boolean deciding whether to display non-error log messages. Default: `false`

To index all models, just add this line:

`tube.index()`

To index specific models, pass in an array of their names as strings:

`tube.index(['MODEL_1', 'MODEL_2'])`

To reset the Elasticsearch index (essentially, wipe it):

`tube.resetIndex()`

Creating a blank Elasticsearch index is similar to the CLI command:

`tube.createIndex()`

Also similar to the CLI command, to clear all models of a certain type:

`tube.clearTypes([array of model names])`

Use the search features similarly to their CLI format:

`tube.simpleSearch([search term], [optional: property])`
`tube.fuzzySearch([search term], [optional: model name], [optional: property])`
`tube.rawQuery({query json})`

## Implementation Patterns

It might be useful to know some of the ways we use model-tube in our Node projects.

### One Configured Tube

We generally create a `model-tube-configured.js` file in the root of a project, and then import a configured model-tube instance where needed:

```
// model-tube-configured.js
require('dotenv').config()
const tube = require('model-tube')({
  'es_host': process.env.ELASTICSEARCH_HOST,
  'whitelist': ['Facility', 'Resource'],
  'logs': false
})
module.exports = tube
```

As you can see, we may like to configure settings with a `.env` file using the `dotenv` package.

We can import this configured-tube into our other files with the following (adjust for your relative path):

`const tube = require('../model-tube-configured')`

### Testing

Here is how we run model-tube with `Jest`.

If you have multiple test files in `Jest`, they may be run simultaneously. This can force model-tube (or multiple model-tubes) to perform many actions at once on your poor Elasticsearch server. Errors will erupt.

To avoid this, we have the following in our Jest `setupFramework.js`:

```
// setupFramework.js
const back = require('../')
const db = require('../models')
const path = require('path')

beforeAll(async () => {
  global.app = back.listen()
  await require('../model-tube-configured').createIndex()
  await require('sequelize-fixtures').loadFile(path.join(__dirname, './fixtures/*.json'), db, { log: () => {} })
})

afterAll(() => {
  global.app.close()
})
```

Since `beforeAll` will run once for every test file, it is critical that we only `createIndex` (this will do nothing if the Elasticsearch index already exists). If we `resetIndex`, then a deletion of the index may occur while another test is sending requests for it (even if it's recreated milliseconds later).

## About
This package was developed by Nicholas Hartunian for UConn's Squared Labs. Shout-out to Brandon Cheng for much appreciated advice.
