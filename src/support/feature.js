const onCommand = require("./commands");
const onComponent = require("./components");
const onSubmit = require("./modals");

class SupportFeature {

    constructor(bot) {

        this.bot = bot

        this.bot.transcriber = new TicketTranscriber(bot.database);
        this.transcriptChannel = null;
        
        bot.on('ready', () => this.onReady())
        bot.on('scrimsCommandCreate', interaction => this.onScrimsCommand(interaction))
        bot.on('scrimsComponentCreate', interaction => this.onScrimsComponent(interaction))
        bot.on('scrimsModalSubmit', interaction => this.onScrimsModalSubmit(interaction))

    }

    get transcriber() {
        return this.bot.transcriber;
    }

    async onScrimsCommand(interaction) {

        await onCommand(interaction).catch(console.error)

    }

    async onScrimsComponent(interaction) {

        await onComponent(interaction).catch(console.error)

    }

    async onScrimsModalSubmit(interaction) {

        const cmd = interaction?.commandName || null;
        if (cmd == "support-modal") return onSubmit(interaction).catch(console.error);

    }

    async onReady() {

        if (this.bot.transcriptChannelId) {
            this.transcriptChannel = await this.bot.channels.fetch(this.bot.transcriptChannelId)
            console.log("TranscriptChannel found and on standby!")
        }

    }
    
}

module.exports = SupportFeature;