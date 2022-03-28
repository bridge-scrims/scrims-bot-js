const { Client, Message, Interaction, CommandInteraction, MessageComponentInteraction, GuildMember, MessageReaction, AutocompleteInteraction } = require("discord.js");
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

        discordModals(this);

    }

    destroy() {

        super.destroy()
        this.database.destroy()
        
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
        console.log("Connected to database!")

        this.permissions = new ScrimsPermissionsClient(this.database)

        await this.commands.initializeCommands()

        this.addEventListeners();
        this.on("scrimsCommandCreate", interaction => this.onScrimsCommand(interaction));

        this.emit("startupComplete")
        console.log("Startup complete")

    }

    async onScrimsCommand(interaction) {

        if (interaction?.commandName == "reload") return this.onReloadCommand(interaction);

    }

    async onReloadCommand(interaction) {

        await interaction.deferReply({ ephemeral: true })

        await this.commands.update().catch(console.error)

        await interaction.editReply({ content: "Commands reloaded!", ephemeral: true })

    }

    expandMessage(message) {

        message.user = message.author

    }

    expandCommandInteraction(cmdInteraction) {

        cmdInteraction.params = cmdInteraction.options
        cmdInteraction.scrimsCommand = this.commands.getScrimsCommand(cmdInteraction.commandName) ?? null

    }

    expandComponentInteraction(interaction) {

        interaction.args = interaction.customId.split("/") || []
        interaction.commandName = interaction.args.shift() || null

    }

    async runHandler(handler, interactEvent, event) {

        try {

            await handler(interactEvent, event)

        }catch(error) {

            console.error(`Unexpected error while handling a ${event}!`, error, interactEvent)

            if (interactEvent instanceof Interaction || interactEvent instanceof discordModals.ModalSubmitInteraction) {
                
                const payload = ScrimsMessageBuilder.errorMessage(
                    "Unexpected Exception", `Unfortunately your command could not be handleld due to an unexpected error.`
                    + ` This error was automatically reported to the bridge scrims developer team.`
                    + ` Sorry for any inconvenience and please try again later.`
                )

                if (interactEvent.replied) await interactEvent.editReply(payload)
                else await interactEvent.reply(payload)

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

    isPermitted(interactEvent) {

        if (!interactEvent.member || !interactEvent.scrimsCommand) return false;

        const { permissionLevel, allowedPositions, requiredPositions } = interactEvent.scrimsCommand
        if (!permissionLevel && !allowedPositions && !requiredPositions) return true;
        
        return interactEvent.member.hasPermission(permissionLevel, allowedPositions, requiredPositions);

    }

    async ensureScrimsUser(interactEvent) {

        interactEvent.scrimsUser = this.database.users.cache.get({ discord_id: interactEvent.user.id })[0]
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
        await this.ensureScrimsUser(interactEvent)

        if (interactEvent.member instanceof GuildMember)
            interactEvent.member.hasPermission = (permissionLevel, allowedPositions, requiredPositions) => this.permissions.hasPermission(interactEvent.member, permissionLevel, allowedPositions, requiredPositions)
        
        if (interactEvent instanceof CommandInteraction)
            if (!this.isPermitted(interactEvent)) 
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
