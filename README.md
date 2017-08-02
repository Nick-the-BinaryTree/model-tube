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

Note: Typing no specific models will index all models

Ex: `tube index`

Shortcut: `i` can be used instead of `index`

### Search Commands
Three ways to simple search all models
`tube simpleSearch [search term] [optional: property to search]`
`tube search [search term] [optional: property to search]`
`tube ss [search term] [optional: property to search]`

Two ways to fuzzy search:
`tube fuzzySearch [search term] [optional: model name] [optional: property]`
`tube fs [search term] [model name] [optional: property]`

Notes:
* If no model name is provided, all models will be searched
* Also, if no property is provided, all properties will be searched
* Raw query has no command b/c typing JSON into a terminal is not optimal

## "In-Code" Usage
If you want to use the `tube index command` in your code, you can import it as follows:

`const tube = require(tube)`

If the default settings in `settings.json` are not to your liking, you can configure them on the import with:

`const tube = require(tube).config({es_host: YOUR_SERVER, es_index: YOUR_INDEX, models_path: YOUR_PATH})`

Note: You only have to enter the JSON keys for settings you want to override. For instance, you could leave out `es_index` to keep the default `app_index`.

To index all models, just add this line:

`tube.index()`

To index specific models, pass in an array of their names as strings:

`tube.index(['MODEL_1', 'MODEL_2'])`

Use the search features similarly to their CLI format:

`tube.simpleSearch([search term], [optional: property])`
`tube.fuzzySearch([search term], [optional: model name], [optional: property])`
`tube.rawQuery({[query json]})`

## About
This package was developed by Nicholas Hartunian for UConn's Squared Labs. Shout-out to Brandon Cheng for much appreciated advice.
