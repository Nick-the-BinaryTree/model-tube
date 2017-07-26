# sql-to-es
Index Sequelize models as Elasticsearch documents.


## Installation
Local to project (what you probably want):
`npm install https://github.com/Nick-the-BinaryTree/sql-to-es`

Global (to use CLI anywhere without npx):
`npm install -g  https://github.com/Nick-the-BinaryTree/sql-to-es`


## CLI Usage
There are two ways to use this package. They are both fabulous.

The first is as a CLI tool.

If you did a global install, you can run this package's commands anywhere in a terminal like so:

`sql-to-es [command]`

If you did a local install, make sure you're in your project directory and just add `npx` to the front:

`npx sql-to-es [command]`

`npx` is built into the latest version of npm or can be downloaded separately.

### Configuration Command
`sql-to-es config [Elasticsearch server address] [Sequelize models folder path]`

Note: Models path is absolute from system root or relative from `node_modules/sql-to-es`

Ex: `sql-to-es config http://localhost:9200 ../../models`

### Index Command
`sql-to-es index [optional: specific model names to index space-separated]`

Ex: `sql-to-es index Facility Resource`

Note: Typing no specific models will index all models

Ex: `sql-to-es index`

### Tip
"c" and "i" can be used instead of "config" and "index"


## "In-Code" Usage
If you want to use the `sql-to-es index command` in your code, you can import it as follows:

`const sql-to-es = require(sql-to-es).config({es_host: YOUR_SERVER, models_path: YOUR_PATH})`

To index all models, just add this line:

`sql-to-es.index()`

To index specific models, pass in an array of their names as strings:

`sql-to-es.index(['Facility', 'Resource'])`


## About
This package was developed by Nicholas Hartunian for UConn's Squared Labs. Shout-out to Brandon Cheng for much appreciated advice.
