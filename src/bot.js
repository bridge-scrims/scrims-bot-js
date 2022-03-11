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

        this.prefix = config?.prefix ?? "!";

        this.supportRoles = config?.supportRoles ?? [];
        this.staffRoles = config?.staffRoles ?? [];

        this.suggestionsChannelId = config?.suggestionsChannelId ?? null;

        discordModals(this);
    }

    async login() {

        await super.login(this.config.token);
        console.log("Connected to discord!")

        this.suggestionUpVote = this.emojis.resolve(this.config.suggestionUpVote) ?? "👍"
        this.suggestionDownVote = this.emojis.resolve(this.config.suggestionDownVote) ?? "👎"

        this.database = new DBClient(this.config);
        await this.database.initializeCache();
        console.log("Connected to database!")

        this.transcriber = new TicketTranscriber(this.database);
        
        const transcriptChannelId = this.config.transcriptChannelId
        if (transcriptChannelId) {
            this.transcriptChannel = await this.channels.fetch(transcriptChannelId)
            console.log("TranscriptChannel found and on standby!")
        }

        const guilds = await this.guilds.fetch().then(oAuth2Guilds => Promise.all(oAuth2Guilds.map(oAuth2Guild => oAuth2Guild.fetch())))
        await Promise.all(guilds.map(guild => this.installCommands(guild)))
        console.log("Commands successfully installed!")

        this.addEventListeners();
        if (this.suggestionsChannelId !== null) await this.initSuggestions()
        
        console.log("Startup complete")

    }

    async installCommands(guild) {
        await guild.commands.set([]) // Reset commands

        const commands = await Promise.all(
            this.rawCommands.map(
                rawCmd => guild.commands.create({ ...rawCmd, permissionLevel: undefined })
                    .then(appCmd => [appCmd, rawCmd])
            )
        )

        commands.forEach(([appCmd, rawCmd]) => this.commandPermissions[appCmd.id] = rawCmd.permissionLevel)
    }

    async initSuggestions() {
        const channel = await this.channels.fetch(this.suggestionsChannelId)
        const oldMessages = await channel.messages.fetchPinned()
        await Promise.all(oldMessages.map(msg => msg.delete()))

        this.suggestionsInfoMessage = await channel.send(ResponseTemplates.suggestionsInfoMessage(channel.guild.name))
        await this.suggestionsInfoMessage.pin()
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
                this.suggestionsInfoMessage = await message.channel.send(ResponseTemplates.suggestionsInfoMessage(message.guild.name)).catch(console.error)
                await this.suggestionsInfoMessage.pin().catch(console.error)
            }
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