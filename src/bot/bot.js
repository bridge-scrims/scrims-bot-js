const { Client, Message, Interaction, CommandInteraction, MessageComponentInteraction, GuildMember, MessageReaction } = require("discord.js");

const SuggestionsFeature = require("../suggestions/feature.js");
const ResponseTemplates = require("./responses.js");
const Commands = require("../assets/commands.json");
const discordModals = require('discord-modals');
const DBClient = require("./database.js");

class ScrimsBot extends Client {

    constructor(config) {
        const intents = [ "GUILD_MEMBERS", "GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES", "GUILD_MESSAGE_REACTIONS" ]
        const partials = [ 'MESSAGE', 'CHANNEL', 'REACTION' ]
        super({ intents, partials });

        this.commands = {};
        this.config = config;
        this.rawCommands = Commands;
        
        this.suggestions = new SuggestionsFeature(this);

        Object.entries(config).forEach(([key, value]) => this[key] = value)

        discordModals(this);
    }

    async login() {

        await super.login(this.config.token);
        console.log("Connected to discord!")

        this.database = new DBClient(this.mysqlLogin);
        await this.database.initializeCache();
        console.log("Connected to database!")


        if (this.application.commands.cache.size === 0) {
            await this.installCommands()
            console.log("Commands successfully installed!")
        }
    
        this.addEventListeners();
        this.on("scrimsCommandCreate", interaction => this.onScrimsCommand(interaction));

        console.log("Startup complete")

    }

    async onScrimsCommand(interaction) {
        if (interaction.commandName == "reload") return this.onReloadCommand(interaction);
    }

    async onReloadCommand(interaction) {
        await this.installCommands().catch(console.error)
        await interaction.reply({ content: "Commands reloaded!", ephemeral: true })
    }

    async installCommands() {
        const commands = await this.application.commands.set(
            this.rawCommands.map(
                rawCmd => ({ ...rawCmd, permissionLevel: undefined })
            )
        )

        const getRawCommand = (appCmd) => this.rawCommands.filter(cmd => cmd.name == appCmd.name)[0]
        commands.forEach(appCmd => this.commands[appCmd.id] = getRawCommand(appCmd))
        this.installCommandPermissions(commands).catch(console.error)
    }


    async installCommandPermissions() {
        await Promise.all(
            Object.entries(this.commands)
                .map(([id, cmd]) => [id, this.getCommandRequiredRoles(cmd)])
                .filter(([_, requiredRoles]) => requiredRoles.length <= 10 && requiredRoles.length !== 0)
                .map(([id, requiredRoles]) => this.application.commands.fetch(id)
                    .then(cmd => cmd.setDefaultPermission(false))
                    .then(cmd => cmd.permissions.set({ 
                        command: cmd.id, permissions: requiredRoles.map(roleId => ({ id: roleId, type: 'ROLE', permission: true }))
                    }))
                )
        )
    }


    /**
     * @param  { { permissionLevel: String, permissions: String[] } } cmd
     * @return  { String[] } The roles that have permission to run the command
     */
    getCommandRequiredRoles(cmd) {
        const permissionLevelRoles = (cmd?.permissionLevel ? this.getRequiredRoles(cmd.permissionLevel) : [])
        return permissionLevelRoles.concat(cmd?.permissions || []);
    }

    /**
     * @param  { GuildMember | Role } permissible
     * @param  { String } permissionLevel
     * @param  { String[] } requiredPermissions
     * @return { Boolean } If the permissible has the given permissionlevel **OR** higher **AND** all the given requiredPermissions
     */
    hasPermission(permissible, permissionLevel, requiredPermissions=[]) {
        return this.hasRequiredPermissions(permissible, requiredPermissions) && this.hasPermissionLevel(permissible, permissionLevel);
    }

    /**
     * @param  { GuildMember | Role } permissible
     * @param  { String } requiredPermission
     * @return { Boolean } If the permissible has permission
     */
    hasRequiredPermission(permissible, requiredPermission) {
        if (permissible?.permissions?.has(requiredPermission)) return true;
        
        const requiredRoles = this.rolePermissions[requiredPermission] || []
        return requiredRoles.some(roleId => permissible?.roles?.cache?.has(roleId))
    }

    /**
     * @param  { GuildMember | Role } permissible
     * @param  { String[] } requiredPermissions
     * @return { Boolean } If the permissible has all requiredPermissions
     */
    hasRequiredPermissions(permissible, requiredPermissions) {
        return requiredPermissions.every(perm => this.hasRequiredPermission(permissible, perm))
    }


    /**
     * @param  { String } permissionLevel
     * @return { String[] } Any roles that are above or at the permissionLevel in the scrims hierarchy
     */
    getPermissionLevelRequiredRoles(permissionLevel) {
        const requiredIndex = this.hierarchy.indexOf(permissionLevel)
        if (requiredIndex === -1) return null;

        return this.hierarchy.slice(0, requiredIndex+1) // Removed all levels of the hierarchy below the required one
    }

    /**
     * @param  { GuildMember | Role } permissible
     * @param  { String } permissionLevel
     * @return { Boolean } If the permissible has the permissionLevel
     */
    hasPermissionLevel(permissible, permissionLevel) {
        const requiredPermissions = this.getPermissionLevelRequiredRoles(permissionLevel)
        return this.hasRequiredPermissions(permissible, requiredPermissions);
    }


    expandMessage(message) {
        message.user = message.author
    }

    expandCommandInteraction(cmdInteraction) {
        cmdInteraction.params = cmdInteraction.options
        cmdInteraction.command = this.commands[cmdInteraction.commandId] ?? null
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
        if (interactEvent instanceof MessageComponentInteraction) this.emit(`scrimsComponent${event}`, interactEvent)
        if (interactEvent instanceof discordModals.ModalSubmitInteraction) this.emit(`scrimsModal${event}`, interactEvent)

    }

    async isPermitted(interactEvent) {
        if (!interactEvent.member || !interactEvent.command) return true;

        const { permissionLevel, requiredPermissions } = interactEvent.command
        return interactEvent.member.hasPermission(permissionLevel, requiredPermissions);
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
        if (interactEvent.member instanceof GuildMember)
            interactEvent.member.hasPermission = (permLevel, requiredPerms) => this.hasPermission(interactEvent.member, permLevel, requiredPerms)
        
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

    }

}



module.exports = ScrimsBot;
