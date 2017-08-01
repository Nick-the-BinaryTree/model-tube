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

### Index Command
`tube index [optional: specific model names to index space-separated]`

Ex: `tube index Facility Resource`

Note: Typing no specific models will index all models

Ex: `tube index`

### Tip
"c" and "i" can be used instead of "config" and "index"


## "In-Code" Usage
If you want to use the `tube index command` in your code, you can import it as follows:

`const tube = require(tube).config({es_host: YOUR_SERVER, models_path: YOUR_PATH})`

To index all models, just add this line:

`tube.index()`

To index specific models, pass in an array of their names as strings:

`tube.index(['Facility', 'Resource'])`


## About
This package was developed by Nicholas Hartunian for UConn's Squared Labs. Shout-out to Brandon Cheng for much appreciated advice.
