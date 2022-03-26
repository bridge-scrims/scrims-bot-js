'use strict';

const ScrimsJSBot = require("./bot.js");
const Config = require('./config.json');

async function main() {

    const bot = new ScrimsJSBot(Config)
    await bot.login()

    process.on('SIGTERM', () => {
        console.log('SIGTERM signal received.');
    
        console.log('Closing Discord connection.');
        bot.destroy();
        console.log('Discord connection closed.');
    
        console.log('------- Log End -------');
        process.exit(0);
    });

}

main().catch(console.error)