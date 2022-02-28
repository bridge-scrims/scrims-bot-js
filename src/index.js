const TicketBot = require("./bot");
const Config = require('./config');

async function main() {

    const bot = new TicketBot(Config)
    await bot.login()

    process.on('SIGTERM', () => {
        console.log('SIGTERM signal received.');
    
        console.log('Closing Discord connection.');
        bot.client.destroy();
        console.log('Discord connection closed.');
    
        console.log('------- Log End -------');
        process.exit(0);
    });

}

main().catch(console.error)