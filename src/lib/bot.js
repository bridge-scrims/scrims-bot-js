const { Client, Message, Interaction, CommandInteraction, MessageComponentInteraction, GuildMember, MessageReaction, AutocompleteInteraction } = require("discord.js");
const discordModals = require('discord-modals');

const ScrimsPermissionsClient = require("./permissions");
const ScrimsCommandInstaller = require("./commands");
const ResponseTemplates = require("./responses");
const DBTable = require("./postgresql/database");

class ScrimsBot extends Client {

    constructor(intents, partials, config) {
        
        super({ intents, partials });

        this.commands = new ScrimsCommandInstaller(this);
        this.config = config;
        
        Object.entries(config).forEach(([key, value]) => this[key] = value)

        discordModals(this);

    }

    destroy() {

        super.destroy()
        this.database.destroy()
        
    }

    async login() {

        await super.login(this.config.token);
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

    emitInteractEvent(interactEvent, event) {

        if (interactEvent instanceof Message) this.emit(`scrimsMessage${event}`, interactEvent)
        if (interactEvent instanceof Interaction) this.emit(`scrimsInteraction${event}`, interactEvent)
        if (interactEvent instanceof MessageReaction) this.emit(`scrimsReaction${event}`, interactEvent)

        if (interactEvent instanceof CommandInteraction) this.emit(`scrimsCommand${event}`, interactEvent)
        if (interactEvent instanceof AutocompleteInteraction) this.emit(`scrimsAutocomplete${event}`, interactEvent)
        if (interactEvent instanceof MessageComponentInteraction) this.emit(`scrimsComponent${event}`, interactEvent)
        if (interactEvent instanceof discordModals.ModalSubmitInteraction) this.emit(`scrimsModal${event}`, interactEvent)

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

        if (interactEvent.partial) interactEvent = await interactEvent.fetch().catch(console.error)
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
        
        this.emitInteractEvent(interactEvent, event)
        
    }

    async onReaction(reaction, user, event) {

        reaction.user = user
        return this.onInteractEvent(reaction, event);

    }

    addEventListeners() {

        this.on('modalSubmit', interaction => this.onInteractEvent(interaction, "Submit"))
        this.on('interactionCreate', interaction => this.onInteractEvent(interaction, "Create"))
		
        this.on('messageCreate', message => this.onInteractEvent(message, "Create"))
        this.on('messageDelete', message => this.onInteractEvent(message, "Delete"))

        this.on('messageReactionAdd', (reaction, user) => this.onReaction(reaction, user, "Add"))
        this.on('messageReactionRemove', (reaction, user) => this.onReaction(reaction, user, "Remove"))

        this.on('guildCreate', guild => this.commands.updateGuildCommandsPermissions(guild))

    }

}


module.exports = ScrimsBot;
