const onReactionUpdate = require('./user-handlers/suggestion-reaction.js');
const handleInteraction = require('./interaction-handler.js');
const ResponseTemplates = require('./response-templates.js');
const TicketTranscriber = require("./ticket-transcriber.js");
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
            partials: [ 'MESSAGE', 'CHANNEL', 'REACTION' ]
		});

        this.config = config;
        this.rawCommands = Commands;
        this.commandPermissions = {};
        this.transcriptChannel = null;

        
        Object.entries(config).forEach(([key, value]) => this[key] = value)

        discordModals(this);
    }

    async login() {

        await super.login(this.config.token);
        console.log("Connected to discord!")

        this.database = new DBClient(this.mysqlLogin);
        await this.database.initializeCache();
        console.log("Connected to database!")

        this.transcriber = new TicketTranscriber(this.database);
        
        if (this.transcriptChannelId) {
            this.transcriptChannel = await this.channels.fetch(this.transcriptChannelId)
            console.log("TranscriptChannel found and on standby!")
        }

        if (this.application.commands.cache.size === 0) {
            await this.installCommands()
            console.log("Commands successfully installed!")
        }
    
        this.addEventListeners();
        if (this.suggestionsChannelId !== null) await this.initSuggestions()
        
        console.log("Startup complete")

    }

    async installCommands() {
        const commands = await this.application.commands.set(
            this.rawCommands.map(
                rawCmd => ({ ...rawCmd, permissionLevel: undefined })
            )
        )

        const getRawCommand = (appCmd) => this.rawCommands.filter(cmd => cmd.name == appCmd.name)[0]
        commands.forEach(appCmd => this.commandPermissions[appCmd.id] = getRawCommand(appCmd).permissionLevel)
    }

    async initSuggestions() {
        const channel = await this.channels.fetch(this.suggestionsChannelId)
        const messages = await channel.messages.fetch()
        await Promise.all(messages.filter(msg => (msg.components.length > 0)).map(msg => msg.delete()))
        await this.sendSuggestionInfoMessage(channel, true)
    }

    async sendSuggestionInfoMessage(channel, resend) {
        clearTimeout(this.suggestionsInfoMessageReload)

        await this.suggestionsInfoMessage?.delete()?.catch(() => null);
        this.suggestionsInfoMessage = await channel.send(ResponseTemplates.suggestionsInfoMessage(channel.guild.name))

        if (resend) this.suggestionsInfoMessageReload = setTimeout(() => this.sendSuggestionInfoMessage(channel, false)?.catch(console.error), 7*60*1000)
    }

    /**
     * Checks if the member or role has the given permissionlevel **OR** higher.
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String } permissionLevel
     */
    hasPermission(permissible, permissionLevel) {
        if (permissionLevel == "ALL") return true;

        if (permissible?.permissions?.has("ADMINISTRATOR")) return true; //Has ADMINISTRATOR -> has perms
        
        if (permissionLevel == "DEV" && this.devRoles.some(roleId => permissible?.roles?.cache?.has(roleId)))
            return true; // Permission needed is DEV and they have developer role -> has perms

        if (permissionLevel == "ADMIN") return false; // Does not have ADMINISTRATOR and ADMINISTRATOR is required -> does not have perms

        if (this.staffRoles.some(roleId => permissible?.roles?.cache?.has(roleId))) return true; //Has STAFF role -> has perms
        if (permissionLevel == "STAFF") return false; // Does not have STAFF role and STAFF is required -> does not have perms

        if (this.supportRoles.some(roleId => permissible?.roles?.cache?.has(roleId))) return true; //Has SUPPORT role -> has perms
        if (permissionLevel == "SUPPORT") return false; // Does not have SUPPORT role and SUPPORT is required -> does not have perms

        return false; // Default = does not have perms - for safety
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
			if (message.partial) message = await message.fetch().catch(console.error)
			if (!message || message.partial) return false;
	
			return handleMessage(message);
		});

        this.on('messageDelete', async (message) => {
            // Suggestion info message was deleted
            if (message.id == this?.suggestionsInfoMessage?.id) {
                //await this.sendSuggestionInfoMessage(message.channel, false)
            }

            const suggestion = message.client.database.cache.getSuggestion(message.id)
            if (suggestion) return message.client.database.removeSuggestion(suggestion.id);
        })

        this.on('messageReactionAdd', async (reaction, user) => {
            if (user.id == this.user.id) return false;
            if (reaction.partial) reaction = await reaction.fetch().catch(console.error)
			await onReactionUpdate(reaction, user).catch(console.error)
        })

        this.on('messageReactionRemove', async (reaction, user) => {
            if (user.id == this.user.id) return false;
            if (reaction.partial) reaction = await reaction.fetch().catch(console.error)
            await onReactionUpdate(reaction, user).catch(console.error)
        })

    }


}



module.exports = ScrimsBot;