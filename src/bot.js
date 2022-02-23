const handleInteraction = require('./interaction-handler.js');
const TicketTranscriber = require("./ticket-transcriber.js");
const handleMessage = require('./message-handler.js');
const discordModals = require('discord-modals');
const DBClient = require("./db-client.js");
const { Client } = require("discord.js");

class TicketBot extends Client {

    constructor(config) {
        super({ 
			intents: [ 
                "GUILD_MEMBERS", "GUILDS", 'GUILD_MESSAGES', 
                "GUILD_VOICE_STATES", "GUILD_MESSAGE_REACTIONS" 
            ],
            partials: [ 'MESSAGE', 'CHANNEL' ]
		});

        this.config = config;
        this.transcriptChannel = null;

        this.prefix = config.prefix;
        this.supportRoles = config?.supportRoles ?? [];

        discordModals(this);
    }

    async login() {

        super.login(this.config.token);

        this.database = new DBClient(this.config);
        await this.database.initializeCache();

        this.transcriber = new TicketTranscriber();
        
        const transcriptChannelId = this.config.transcriptChannelId
        if (transcriptChannelId) {
            this.transcriptChannel = await this.channels.fetch(transcriptChannelId)
        }

        this.addEventListeners();

    }

    addEventListeners() {

        this.on('modalSubmit', handleInteraction);

        this.on('interactionCreate', async (interaction) => {
			if (interaction?.user?.bot) return false;

			if (interaction.partial) interaction = await interaction.fetch().catch(console.error)
			if (!interaction || interaction.partial) return false;
	
			return handleInteraction(interaction);
		});
		
		this.on('messageCreate', async (message) => {
			if (message.type === 'CHANNEL_PINNED_MESSAGE') return false;
            if (message?.author?.bot) return false;

			if (message.partial) message = await message.fetch().catch(console.error)
			if (!message || message.partial) return false;
	
			return handleMessage(message);
		});

    }

}

module.exports = TicketBot;