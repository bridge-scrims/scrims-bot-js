'use strict';

const ScrimsJSBot = require("./bot.js");
const Config = require('./config.json');

const createDatabase = require("./create-db.js");
const setupLog = require("./logging.js");

function terminate(bot) {

    console.log('shutdown signal received');
    
    bot.destroy();

    console.log('------- Log End -------');
    process.exit(0);

}

async function main() {

    await createDatabase()

    // Will also effect the normal console output, so this should not be used during development.
    if (!Config.testing) await setupLog()

    const bot = new ScrimsJSBot(Config)
    await bot.login()

    process.on('SIGINT', () => terminate(bot));
    process.on('SIGTERM', () => terminate(bot));

}

main().catch(error => {

    console.log(error)
    process.exit(-1)
    
})