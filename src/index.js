'use strict';

const ScrimsJSBot = require("./bot.js");
const Config = require('./config.json');

function terminate(bot) {

    console.log('SIGTERM signal received.');
    
    console.log('Closing Discord connection.');
    bot.destroy();
    console.log('Discord connection closed.');

    console.log('------- Log End -------');
    process.exit(0);

}

async function main() {

    const bot = new ScrimsJSBot(Config)
    await bot.login()

    process.on('SIGINT', () => terminate(bot));
    process.on('SIGTERM', () => terminate(bot));

}

main().catch(console.error)