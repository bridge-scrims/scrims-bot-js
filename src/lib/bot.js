const { 
    Client, Message, Interaction, CommandInteraction, 
    MessageComponentInteraction, GuildMember, AutocompleteInteraction, 
    ModalSubmitInteraction, Modal, TextInputComponent, Role, User 
} = require("discord.js");

const LimitedComponentContainer = require("./components/limited_components");
const ScrimsCommandInstaller = require("./tools/command_installer");
const ScrimsUserUpdater = require("./tools/user_updater");
const I18n = require("./tools/internationalization");

const HypixelClient = require("./middleware/hypixel");
const MojangClient = require("./middleware/mojang");
const DBClient = require("./postgresql/database");

const { interactionHandler, eventHandlers, commands } = require("./commands");
const ScrimsPermissionsClient = require("./permissions");
const ScrimsMessageBuilder = require("./responses");
const auditEvents = require("./audited_events");
const ScrimsGuild = require("./scrims/guild");
const ScrimsUser = require("./scrims/user");
const { validate } = require("uuid");

class ScrimsBot extends Client {

    constructor(intents, partials, presence, config) {
        
        super({ intents, partials, presence });

        this.eventHandlers = {};
        this.token = process.env.DISCORD_TOKEN ?? config.discordToken;

        /** @type {DBClient} */
        this.database = new DBClient(config.dbLogin, this)

        /** @type {ScrimsPermissionsClient} */
        this.permissions = new ScrimsPermissionsClient(this.database)

        /** @type {ScrimsCommandInstaller} */
        this.commands = new ScrimsCommandInstaller(this);

        /** @type {ScrimsUserUpdater} */
        this.scrimsUsers = new ScrimsUserUpdater(this)

        /** @type {LimitedComponentContainer} */
        this.limitedComponents = new LimitedComponentContainer(this)

        /** @type {HypixelClient} */
        this.hypixel = new HypixelClient(config.hypixelToken);

        /** @type {MojangClient} */
        this.mojang = new MojangClient();

        /** @type {boolean} */
        this.blocked = false

        /** @type {string[]} */
        this.handles = []

        /** @type {I18n} */
        this.i18n = null

        this.on('error', console.error)
        this.on('shardError', console.error)

        commands.forEach(([ cmdData, cmdPerms, cmdConfig ]) => this.commands.add(cmdData, cmdPerms, cmdConfig))

    }

    async destroy() {

        this.database.destroy().catch(() => null)
        super.destroy()
        process.exit(0)
        
    }

    getConfig(guild_id, key) {

        return this.database.guildEntrys.cache.find({ guild_id, type: { name: key } })?.value ?? null;

    }

    addEventHandler(handlerId, handler) {

        this.eventHandlers[handlerId] = handler

    }

    removeEventHandler(handlerId) {

        delete this.eventHandlers[handlerId]

    }

    async login() {

        await I18n.initializeLocales()
        this.i18n = I18n.getInstance()

        await super.login(this.token)
        console.log("Connected to discord!")

        const guilds = await this.guilds.fetch()

        await this.database.connect();
        this.emit("databaseConnected")
        console.log("Connected to database!")

        this.addEventListeners()

        console.log("Initializing commands...")
        await this.commands.initializeCommands()
        console.log("Commands initialized!")

        console.log("Initializing guilds...")
        await Promise.all(guilds.map(guild => this.updateScrimsGuild(null, guild)))
        console.log("Guilds initialized!")
        
        console.log("Initializing guild members...")
        await Promise.all(guilds.map(guild => this.scrimsUsers.initializeGuildMembers(guild)))
        console.log("Guild members initialized!")
        
        this.emit("startupComplete")
        console.log("Startup complete!")

    }

    expandMessage(message) {

        message.user = message.author

    }

    expandCommandInteraction(cmdInteraction) {

        cmdInteraction.params = cmdInteraction.options
        cmdInteraction.scrimsCommand = this.commands.getScrimsCommand(cmdInteraction.commandName) ?? null
        cmdInteraction.commandConfig = this.commands.getScrimsCommandConfiguration(cmdInteraction.commandName) ?? null
        cmdInteraction.scrimsPermissions = this.commands.getScrimsCommandPermissions(cmdInteraction.commandName) ?? null
        cmdInteraction.send = async (payload) => {
            if (cmdInteraction.replied || cmdInteraction.deferred) return cmdInteraction.editReply(payload);
            return cmdInteraction.reply(payload)
        } 

    }

    expandComponentInteraction(interaction) {

        interaction.args = interaction.customId.split("/") || []
        interaction.commandName = interaction.args.shift() || null
        interaction.send = async (payload) => {
            if (interaction.replied || interaction.deferred) return interaction.editReply(payload);
            return interaction.update(payload)
        } 

    }

    /**
     * @param { I18n } i18n 
     * @param { Error } error
     */
    getErrorPayload(i18n, error) {

        if (error?.code == 'ECONNREFUSED') return ScrimsMessageBuilder.errorMessage(i18n.get('command_failed_title'), i18n.get('command_failed'));
        return ScrimsMessageBuilder.errorMessage(i18n.get('unexpected_error_title'), i18n.get('unexpected_error'));

    }

    /** @param {Role} role */
    hasRolePermissions(role) {

        const botMember = role.guild.members.cache.get(this.user.id)
        if (!botMember) return false;
        
        if (!(role.guild.ownerId === this.user.id || botMember.permissions.has("ADMINISTRATOR") || botMember.permissions.has("MANAGE_ROLES"))) return false;
        
        const largest = Math.max( ...botMember.roles.cache.map(role => role.position) )
        return (largest > role.position);

    }

    async runHandler(handler, interactEvent, event) {

        const id = interactEvent?.id || `${Date.now()}`
        if (!this.handles.indexOf(id)) this.handles.push(id)

        try {

            const defer = interactEvent?.commandConfig?.ephemeralDefer
            if (defer !== undefined && !(interactEvent instanceof AutocompleteInteraction)) 
                await interactEvent.deferReply({ ephemeral: defer })
            await handler(interactEvent, event)

        }catch(error) {

            // Fail safe for unexpected command handler errors e.g. database errors

            if (!['Unknown interaction', 'The user aborted a request.'].includes(error.message))
                console.error(`Unexpected error while handling a ${event}!`, error, interactEvent)

            if (interactEvent instanceof Interaction) {
                
                if (!(interactEvent instanceof Interaction && interactEvent.isAutocomplete())) {

                    if (interactEvent instanceof ModalSubmitInteraction)
                        if (!interactEvent.replied && !interactEvent.deferred) await interactEvent.deferReply({ ephemeral: true }).catch(() => null)

                    const payload = this.getErrorPayload(interactEvent.i18n, error)

                    if (interactEvent.replied || interactEvent.deferred) await interactEvent.editReply(payload).catch(() => null)
                    else await interactEvent.reply(payload).catch(() => null)

                }

            }

        }

        this.handles = this.handles.filter(v => v !== id)

    }

    async handleInteractEvent(interactEvent, event) {

        const handlerIdentifier = interactEvent?.commandName || null;

        const handler = this.limitedComponents.getHandler(handlerIdentifier) || this.eventHandlers[handlerIdentifier]
        if (handler) return this.runHandler(handler, interactEvent, event);

        if (interactEvent instanceof Interaction) {

            if (interactEvent instanceof MessageComponentInteraction) await interactEvent.update({ content: interactEvent.i18n.get('message_not_hosted'), components: [], embeds: [] }).catch(console.error)
            else if (interactEvent instanceof AutocompleteInteraction) await interactEvent.respond([]).catch(console.error)
            else await interactEvent.reply({ content: interactEvent.i18n.get('missing_command_handler'), ephemeral: true }).catch(console.error)

        }

        this.emit(`scrims${event}`, interactEvent)

    }

    async isPermitted(interactEvent) {

        if (!interactEvent.scrimsPermissions || !interactEvent.userPositions) return false;

        const { permissionLevel, allowedPositions, requiredPositions } = interactEvent.scrimsPermissions
        if (!permissionLevel && !allowedPositions && !requiredPositions) return true;
        
        if (interactEvent.member)
            return interactEvent.member.hasPermission(permissionLevel, allowedPositions, requiredPositions);
        
        if (interactEvent.scrimsUser)
            return interactEvent.scrimsUser.permissions.hasPermission(Object.values(interactEvent.userPositions), permissionLevel, allowedPositions, requiredPositions)

        return false;
        
    }

    expandMember(member, scrimsUser) {

        if (scrimsUser) member.scrimsUser = scrimsUser
        if (!member.scrimsUser) member.scrimsUser = this.database.users.cache.find({ discord_id: member.id })

        member.id_user = member?.scrimsUser?.id_user ?? null
        return member;
       
    }

    async expandInteractionMember(interation) {

        if (interation.scrimsUser) {

            interation.userPositions = await interation.scrimsUser.permissions.fetchPositions() 
            if (interation.member) {
                interation.member.userPositions = interation.userPositions
                interation.member.hasPermission = (...args) => this.permissions.hasPermission(interation.member, Object.values(interation.userPositions), ...args);
            }

        }else {

            interation.userPositions = {}
            if (interation.member) {
                interation.member.userPositions = interation.userPositions
                interation.member.hasPermission = () => false;
            }

        }

    }

    /**
     * @param { Modal } modal 
     * @param { MessageComponentInteraction | CommandInteraction } interaction 
     * @param { TextInputComponent[] } fields 
     */
    async sendModal(modal, interaction, fields=[]) {

        const inputs = modal.components.map(v => v.components[0]).flat()
        fields.forEach(field => {

            const input = inputs.filter(value => value.customId === field.customId)[0]
            if (input) {

                input.value = field.value

            }

        })

        await interaction.showModal(modal)

    }

    async onInteractEvent(interactEvent, event, allowParials=false) {

        if (interactEvent.partial && !allowParials) interactEvent = await interactEvent.fetch().catch(() => null)
        if (!interactEvent) return false;

        const isCommandInteraction = (interactEvent instanceof CommandInteraction)
        const isAutoCompleteInteraction = (interactEvent instanceof AutocompleteInteraction)
        const isComponentInteraction = (interactEvent instanceof MessageComponentInteraction)
        const isModalSumbitInteraction = (interactEvent instanceof ModalSubmitInteraction)
        const isInteraction = (interactEvent instanceof Interaction)

        interactEvent.database = this.database
        interactEvent.i18n = I18n.getInstance(interactEvent?.locale)

        if (interactEvent instanceof Message) this.expandMessage(interactEvent)

        if (isCommandInteraction)  this.expandCommandInteraction(interactEvent)
        if (isComponentInteraction || isModalSumbitInteraction) this.expandComponentInteraction(interactEvent)

        if (isCommandInteraction || isComponentInteraction)
            interactEvent.sendModal = async (modal, fields) => this.sendModal(modal, interactEvent, fields)

        if (interactEvent.user) interactEvent.userId = interactEvent.user.id
        if (interactEvent.commandName === "CANCEL" && isComponentInteraction) 
            return interactEvent.update({ content: interactEvent.i18n.get('operation_cancelled'), embeds: [], components: [] }).catch(console.error);

        if (interactEvent.commandName === "ping" && isCommandInteraction) 
            return interactEvent.reply({ content: `pong`, embeds: [], components: [], ephemeral: true }).catch(console.error);

        if (
            this.blocked && isInteraction && !(interactEvent?.commandConfig?.bypassBlock)
            && (this.handles.indexOf(interactEvent.id) === -1) && (this.handles.indexOf(interactEvent.commandName) === -1)
            && !(interactEvent.commandName === "killAction")
        ) {

            if (isAutoCompleteInteraction) await interactEvent.respond([]).catch(console.error);
            else if (isCommandInteraction || isComponentInteraction || isModalSumbitInteraction) 
                await interactEvent.reply({ content: interactEvent.i18n.get('blocked_cancel'), ephemeral: true }).catch(console.error);

            this.emit('blocked', interactEvent.constructor.name)
            
            return false;

        }

        if (interactEvent.member instanceof GuildMember) this.expandMember(interactEvent.member)
        if (interactEvent?.member?.scrimsUser) interactEvent.scrimsUser = interactEvent.member.scrimsUser
        if (interactEvent.user && !interactEvent.scrimsUser) {

            if (interactEvent?.commandConfig?.forceScrimsUser) {
                interactEvent.scrimsUser = await this.database.users.find({ discord_id: interactEvent.user.id }).catch(console.error)
                
                if ((interactEvent.scrimsUser === null) && interactEvent.member) 
                    interactEvent.scrimsUser = await this.scrimsUsers.createScrimsUser(interactEvent.member).catch(console.error)

                if (!interactEvent.scrimsUser) {
                    if (isCommandInteraction || isComponentInteraction || isModalSumbitInteraction) 
                        await interactEvent.reply(ScrimsMessageBuilder.scrimsUserNeededMessage(interactEvent.i18n)).catch(console.error);
        
                    return false;
                }
            }

            interactEvent.scrimsUser = this.database.users.cache.find({ discord_id: interactEvent.user.id })

        }

        if (isInteraction) await this.expandInteractionMember(interactEvent)

        if (interactEvent.user && interactEvent.scrimsUser) 
            this.scrimsUsers.update(interactEvent.user, interactEvent.scrimsUser).catch(console.error)
            
        if (isCommandInteraction)
            if (!(await this.isPermitted(interactEvent))) 
                return interactEvent.reply(ScrimsMessageBuilder.missingPermissionsMessage(interactEvent.i18n, interactEvent.i18n.get('missing_command_permissions'))).catch(console.error);
        
        if (interactEvent?.commandConfig?.forceGuild && !interactEvent.guild) {

            if (isCommandInteraction || isComponentInteraction || isModalSumbitInteraction) 
                await interactEvent.reply(ScrimsMessageBuilder.guildOnlyMessage(interactEvent.i18n)).catch(console.error);

            return false;

        }

        return this.handleInteractEvent(interactEvent, event)
        
    }

    async onReaction(reaction, user, event) {

        reaction.user = user
        return this.onInteractEvent(reaction, event);

    }

    async updateScrimsGuild(oldGuild, newGuild) {

        const existing = this.database.guilds.cache.resolve(newGuild.id)
        if (!existing) {

            return this.database.guilds.create(ScrimsGuild.fromDiscordGuild(newGuild))
                .catch(error => console.error(`Unable to create scrims guild because of ${error}!`));

        }

        if (existing?.name !== newGuild.name || existing?.icon !== newGuild.icon) {

            await this.database.guilds.update({ guild_id: newGuild.id }, { name: newGuild.name, icon: (newGuild?.icon ?? null) })
                .catch(error => console.error(`Unable to update scrims guild because of ${error}!`))

        }

    }

    addEventListeners() {

        auditEvents(this)

        this.on('modalSubmit', interaction => this.onInteractEvent(interaction, "ModalSubmit"))
        this.on('interactionCreate', interaction => this.onInteractEvent(interaction, "InteractionCreate"))
		
        this.on('messageCreate', message => this.onInteractEvent(message, "MessageCreate"))

        this.on('messageReactionAdd', (reaction, user) => this.onReaction(reaction, user, "ReactionAdd"))
        this.on('messageReactionRemove', (reaction, user) => this.onReaction(reaction, user, "ReactionRemove"))

        this.on('guildCreate', guild => this.updateScrimsGuild(null, guild))
        this.on('guildUpdate', (oldGuild, newGuild) => this.updateScrimsGuild(oldGuild, newGuild))

        this.on('guildCreate', guild => this.commands.updateGuildCommandsPermissions(guild))

        commands.forEach(([ cmdData, _ ]) => this.addEventHandler(cmdData.name, interactionHandler))
        eventHandlers.forEach(event => this.addEventHandler(event, interactionHandler))

    }

}


module.exports = ScrimsBot;
