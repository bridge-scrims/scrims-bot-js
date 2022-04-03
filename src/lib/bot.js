const { Client, Message, Interaction, CommandInteraction, MessageComponentInteraction, GuildMember } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const discordModals = require('discord-modals');

const ScrimsPermissionsClient = require("./permissions");
const HypixelClient = require("./middleware/hypixel");
const ScrimsCommandInstaller = require("./commands");
const ScrimsMessageBuilder = require("./responses");
const MojangClient = require("./middleware/mojang");
const ResponseTemplates = require("./responses");
const DBTable = require("./postgresql/database");


class ScrimsBot extends Client {

    constructor(intents, partials, config) {
        
        super({ intents, partials });

        this.eventHandlers = {};
        this.config = config;

        this.commands = new ScrimsCommandInstaller(this);
        this.hypixel = new HypixelClient(config.hypixelToken);
        this.mojang = new MojangClient();
        
        Object.entries(config).forEach(([key, value]) => this[key] = value)

        this.addReloadCommand()
        this.addConfigCommand()
        discordModals(this);

    }

    destroy() {

        super.destroy()
        this.database.destroy()
        
    }

    addReloadCommand() {
        
        const reloadCommand = new SlashCommandBuilder()
            .setName("reload")
            .setDescription("Reloads the application commands and permissions.")

        this.commands.add(reloadCommand, { permissionLevel: "staff" })

    }

    addConfigCommand() {
        
        const configCommand = new SlashCommandBuilder()
            .setName("config")
            .setDescription("Used to configure the bot for this discord server.")
            .addIntegerOption(option => (
                option
                    .setName("key")
                    .setDescription("What exact you are trying to configure.")
                    .setAutocomplete(true)
                    .setRequired(true)
            ))
            .addStringOption(option => (
                option
                    .setName("value")
                    .setDescription("The new value of the key you choose.")
                    .setRequired(false)
            ))

        this.commands.add(configCommand, { permissionLevel: "owner" })

    }

    addEventHandler(handlerId, handler) {

        this.eventHandlers[handlerId] = handler

    }

    removeEventHandler(handlerId) {

        delete this.eventHandlers[handlerId]

    }

    async login() {

        await super.login(this.config.discordToken);
        console.log("Connected to discord!")

        this.database = new DBTable(this.config.dbLogin)
        await this.database.connect();
        this.emit("databaseConnected")
        console.log("Connected to database!")

        this.permissions = new ScrimsPermissionsClient(this.database)

        await this.commands.initializeCommands()

        this.addEventHandler("reload", interaction => this.onReloadCommand(interaction))
        this.addEventHandler("config", interaction => this.onConfigCommand(interaction))
        this.addEventListeners();

        this.emit("startupComplete")
        console.log("Startup complete")

    }

    async onReloadCommand(interaction) {

        await interaction.deferReply({ ephemeral: true })

        await this.database.positions.get({ }, false)
        await this.database.userPositions.get({ }, false)
        await this.database.positionRoles.get({ }, false)

        await this.commands.update().catch(console.error)

        await interaction.editReply({ content: "Commands reloaded!", ephemeral: true })

    }

    async onConfigAutocomplete(interaction) {

        const entryTypes = await this.database.guildEntryTypes.get({ })
        await interaction.respond(entryTypes.map(type => ({ name: type.name, value: type.id_type })))

    }

    async onConfigCommand(interaction) {

        if (interaction.isAutocomplete()) return this.onConfigAutocomplete(interaction);
        if (!interaction.guild) return interaction.reply( ScrimsMessageBuilder.guildOnlyMessage() );

        const entryTypeId = interaction.options.getInteger("key")
        const value = interaction.options.getString("value") ?? null

        const selector = { guild_id: interaction.guild.id, id_type: entryTypeId }
        const entry = await this.database.guildEntrys.get(selector)

        if (!value) return interaction.reply({ content: `${entry[0]?.value || null}`, allowedMentions: { parse: [] }, ephemeral: true });
        
        if (entry.length > 0) {

            await this.database.guildEntrys.update(selector, { value })
            return interaction.reply({ content: `${entry[0].value} **->** ${value}`, allowedMentions: { parse: [] }, ephemeral: true });

        }

        await this.database.guildEntrys.create({ ...selector, value })
        await interaction.reply({ content: `${value}`, allowedMentions: { parse: [] }, ephemeral: true });

    } 

    expandMessage(message) {

        message.user = message.author

    }

    expandCommandInteraction(cmdInteraction) {

        cmdInteraction.params = cmdInteraction.options
        cmdInteraction.scrimsCommand = this.commands.getScrimsCommand(cmdInteraction.commandName) ?? null
        cmdInteraction.scrimsPermissions = this.commands.getScrimsCommandPermissions(cmdInteraction.commandName) ?? null

    }

    expandComponentInteraction(interaction) {

        interaction.args = interaction.customId.split("/") || []
        interaction.commandName = interaction.args.shift() || null

    }

    getErrorPayload(error) {

        if (error?.code == 'ECONNREFUSED') return ScrimsMessageBuilder.errorMessage(
            "Command Failed", `Unfortunately your command cannot be handled at the moment. Please try again later.`
        );

        return ScrimsMessageBuilder.errorMessage(
            "Unexpected Exception", `Unfortunately your command could not be handled due to an unexpected error.`
            + ` This error was automatically reported to the bridge scrims developer team.`
            + ` Sorry for any inconvenience. Please try again later.`
        );

    }

    async runHandler(handler, interactEvent, event) {

        try {

            await handler(interactEvent, event)

        }catch(error) {

            console.error(`Unexpected error while handling a ${event}!`, error, interactEvent)

            if (interactEvent instanceof Interaction || interactEvent instanceof discordModals.ModalSubmitInteraction) {
                
                if (interactEvent instanceof Interaction && interactEvent.isAutocomplete()) return false;

                const payload = this.getErrorPayload(error)

                if (interactEvent.replied || interactEvent.deferred) await interactEvent.editReply(payload).catch(console.error)
                else await interactEvent.reply(payload).catch(console.error)

            }

        }

    }

    async handleInteractEvent(interactEvent, event) {

        const handlerIdentifier = interactEvent?.commandName || null;
        const handler = this.eventHandlers[handlerIdentifier]
        if (handler) return this.runHandler(handler, interactEvent, event)

        if (interactEvent instanceof Interaction || interactEvent instanceof discordModals.ModalSubmitInteraction) {

            await interactEvent.reply({ content: "This command does not have a handler. Please refrain from trying again.", ephemeral: true });

        }

        this.emit(`scrims${event}`, interactEvent)

    }

    async isPermitted(interactEvent) {

        if (!interactEvent.member || !interactEvent.scrimsPermissions) return false;

        const { permissionLevel, allowedPositions, requiredPositions } = interactEvent.scrimsPermissions
        if (!permissionLevel && !allowedPositions && !requiredPositions) return true;
        
        const hasPermission = interactEvent.member.hasPermission(permissionLevel, allowedPositions, requiredPositions).catch(error => error);
        if (hasPermission instanceof Error) {

            console.error(`Unable to check if user has permission because of ${hasPermission}!`)
            return false;

        }
        return hasPermission;

    }

    async ensureScrimsUser(interactEvent) {

        interactEvent.scrimsUser = await this.database.users.get({ discord_id: interactEvent.user.id }).then(users => users[0] ?? null)
            .catch(error => console.error(`Unable to get scrims user for ${interactEvent.userId}!`, error))
            
        if (!interactEvent.scrimsUser && interactEvent.member) {
            interactEvent.scrimsUser = await this.database.users.create({ 
                discord_id: interactEvent.userId, 
                discord_tag: interactEvent.user.tag, 
                joined_at: Math.round(interactEvent.member.joinedTimestamp/1000) 
            }).catch(error => console.error(`Unable to make scrims user for ${interactEvent.userId}!`, error))
        }
            
    }

    async onInteractEvent(interactEvent, event) {

        if (interactEvent.partial) interactEvent = await interactEvent.fetch().catch(() => null)
        if (!interactEvent || interactEvent.partial) return false;

        if (interactEvent instanceof Message) this.expandMessage(interactEvent)
        if (interactEvent instanceof CommandInteraction) this.expandCommandInteraction(interactEvent)

        const isComponentInteraction = (interactEvent instanceof MessageComponentInteraction)
        const isModalSumbitInteraction = (interactEvent instanceof discordModals.ModalSubmitInteraction)
        if (isComponentInteraction || isModalSumbitInteraction) this.expandComponentInteraction(interactEvent)

        interactEvent.userId = interactEvent.user.id
        if (interactEvent.commandName == "CANCEL" && isComponentInteraction) 
            return interactEvent.update({ content: `Operation cancelled.`, embeds: [], components: [] });

        await this.ensureScrimsUser(interactEvent)

        if (interactEvent.member instanceof GuildMember)
            interactEvent.member.hasPermission = async (permissionLevel, allowedPositions, requiredPositions) => this.permissions.hasPermission(interactEvent.member, permissionLevel, allowedPositions, requiredPositions)
        
        if (interactEvent instanceof CommandInteraction)
            if (!(await this.isPermitted(interactEvent))) 
                return interactEvent.reply(ResponseTemplates.errorMessage("Insufficient Permissions", "You are missing the required permissions to use this command!")).catch(console.error);
        
        return this.handleInteractEvent(interactEvent, event)
        
    }

    async onReaction(reaction, user, event) {

        reaction.user = user
        return this.onInteractEvent(reaction, event);

    }

    addEventListeners() {

        this.on('modalSubmit', interaction => this.onInteractEvent(interaction, "ModalSubmit"))
        this.on('interactionCreate', interaction => this.onInteractEvent(interaction, "InteractionCreate"))
		
        this.on('messageCreate', message => this.onInteractEvent(message, "MessageCreate"))
        this.on('messageDelete', message => this.onInteractEvent(message, "MessageDelete"))

        this.on('messageReactionAdd', (reaction, user) => this.onReaction(reaction, user, "ReactionAdd"))
        this.on('messageReactionRemove', (reaction, user) => this.onReaction(reaction, user, "ReactionRemove"))

        this.on('guildCreate', guild => this.commands.updateGuildCommandsPermissions(guild))

    }

}


module.exports = ScrimsBot;
