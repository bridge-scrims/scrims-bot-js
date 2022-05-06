'use strict';

const ScrimsJSBot = require("./bot.js");
const Config = require('./config.json');
const setupLog = require("./logging.js");

function terminate(bot) {

    console.log('shutdown signal received');
    
    bot.destroy();

    console.log('------- Log End -------');
    process.exit(0);

}

async function main() {

    // Will also effect the normal console output, so this should not be used during development.
    await setupLog()

    const bot = new ScrimsJSBot(Config)
    await bot.login()

    process.on('SIGINT', () => terminate(bot));
    process.on('SIGTERM', () => terminate(bot));

}

main().catch(console.error)