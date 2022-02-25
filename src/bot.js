const handleInteraction = require('./interaction-handler.js');
const TicketTranscriber = require("./ticket-transcriber.js");
const ScrimsBotCommandInstaller = require("./commands.js");
const handleMessage = require('./message-handler.js');
const Commands = require("./assets/commands.json");
const discordModals = require('discord-modals');
const DBClient = require("./db-client.js");
const { Client } = require("discord.js");

class ScrimsBot extends Client {

    constructor(config) {
        super({ 
			intents: [ 
                "GUILD_MEMBERS", "GUILDS", 'GUILD_MESSAGES', 
                "GUILD_VOICE_STATES", "GUILD_MESSAGE_REACTIONS" 
            ],
            partials: [ 'MESSAGE', 'CHANNEL' ]
		});

        this.config = config;
        this.commands = new ScrimsBotCommandInstaller(this, Commands);
        this.transcriptChannel = null;

        this.prefix = config.prefix;
        this.supportRoles = config?.supportRoles ?? [];
        this.staffRoles = config?.staffRoles ?? [];

        discordModals(this);
    }

    async login() {

        await super.login(this.config.token);
        console.log("Connected to discord!")

        this.database = new DBClient(this.config);
        await this.database.initializeCache();
        console.log("Connected to database!")

        this.transcriber = new TicketTranscriber(this.database);
        
        const transcriptChannelId = this.config.transcriptChannelId
        if (transcriptChannelId) {
            this.transcriptChannel = await this.channels.fetch(transcriptChannelId)
            console.log("TranscriptChannel found and on standby!")
        }

        console.log("Installing commands...")
        const guilds = await this.guilds.fetch().then(oAuth2Guilds => Promise.all(oAuth2Guilds.map(oAuth2Guild => oAuth2Guild.fetch())))
        await Promise.all(guilds.map(guild => this.commands.install(guild)))
        console.log("Commands successfully installed!")

        this.addEventListeners();
        console.log("Startup complete")

    }

    /**
     * Checks if the member or role has the given permissionlevel **OR** higher.
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String } permissionLevel
     */
    hasPermission(permissible, permissionLevel) {
        if (permissionLevel == "ALL") return true;

        if (permissible?.permissions?.has("ADMINISTRATOR")) return true;
        if (permissionLevel == "ADMIN") return false;

        if (this.staffRoles.some(roleId => permissible?.roles?.cache?.has(roleId))) return true;
        if (permissionLevel == "STAFF") return false;

        if (this.supportRoles.some(roleId => permissible?.roles?.cache?.has(roleId))) return true;
        if (permissionLevel == "SUPPORT") return false;

        return false;
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



module.exports = ScrimsBot;