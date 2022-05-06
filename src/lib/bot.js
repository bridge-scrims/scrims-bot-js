const { Client, Message, Interaction, CommandInteraction, MessageComponentInteraction, GuildMember, MessageReaction } = require("discord.js");
const discordModals = require('discord-modals');

const ScrimsCommandInstaller = require("./command_installer");
const ScrimsPermissionsClient = require("./permissions");
const HypixelClient = require("./middleware/hypixel");
const ScrimsMessageBuilder = require("./responses");
const MojangClient = require("./middleware/mojang");
const DBClient = require("./postgresql/database");
const ResponseTemplates = require("./responses");
const auditEvents = require("./audited_events");

const { interactionHandler, eventHandlers, commands } = require("./commands");
const ScrimsUserUpdater = require("./user_updater");
const MemoryMessageButton = require("./memory_button");

class ScrimsBot extends Client {

    constructor(intents, partials, config) {
        
        super({ intents, partials });

        this.eventHandlers = {};
        this.token = config.discordToken;

        /**
         * @type { DBClient }
         */
        this.database = new DBClient(this, config.dbLogin)

        /**
         * @type { ScrimsPermissionsClient }
         */
        this.permissions = new ScrimsPermissionsClient(this.database)

        /**
         * @type { ScrimsCommandInstaller }
         */
        this.commands = new ScrimsCommandInstaller(this);

        /**
         * @type { ScrimsUserUpdater }
         */
        this.scrimsUsers = new ScrimsUserUpdater(this)

        /**
         * @type { HypixelClient }
         */
        this.hypixel = new HypixelClient(config.hypixelToken);

        /**
         * @type { MojangClient }
         */
        this.mojang = new MojangClient();

        /**
         * @type { boolean }
         */
        this.blocked = false

        /**
         * @type { string[] }
         */
        this.handles = []

        discordModals(this)
        auditEvents(this)

        commands.forEach(([ cmdData, cmdPerms ]) => this.commands.add(cmdData, cmdPerms))

    }

    destroy() {

        super.destroy()
        this.database.destroy().catch(() => null)
        
    }

    getConfig(guildId, key) {

<<<<<<< HEAD
        return this.database.guildEntrys.cache.find({ guild_id, type: { name: key } })[0]?.value;
=======
        return this.database.guildEntrys.cache.get({ guild: { discord_id: guildId }, type: { name: key } })[0]?.value;
>>>>>>> main

    }

    addEventHandler(handlerId, handler) {

        this.eventHandlers[handlerId] = handler

    }

    removeEventHandler(handlerId) {

        delete this.eventHandlers[handlerId]

    }

    async login() {

        await super.login(this.token);
        console.log("Connected to discord!")

        this.user.setPresence({ activities: [{ type: 'WATCHING', name: 'cat memes' }] })

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

        const id = interactEvent?.id || `${Date.now()}`
        this.handles.push(id)

        try {

            await handler(interactEvent, event)

        }catch(error) {

            // Fail safe for unexpected command handler errors e.g. database errors

            console.error(`Unexpected error while handling a ${event}!`, error, interactEvent)

            if (interactEvent instanceof Interaction || interactEvent instanceof discordModals.ModalSubmitInteraction) {
                
                if (!(interactEvent instanceof Interaction && interactEvent.isAutocomplete())) {

                    const payload = this.getErrorPayload(error)

                    if (interactEvent.replied || interactEvent.deferred) await interactEvent.editReply(payload).catch(() => null)
                    else await interactEvent.reply(payload).catch(() => null)

                }

            }

        }

        this.handles = this.handles.filter(v => v !== id)

    }

    async handleInteractEvent(interactEvent, event) {

        const handlerIdentifier = interactEvent?.commandName || null;

        const handler = MemoryMessageButton.getHandler(handlerIdentifier) || this.eventHandlers[handlerIdentifier]
        if (handler) return this.runHandler(handler, interactEvent, event)

        if (interactEvent instanceof Interaction || interactEvent instanceof discordModals.ModalSubmitInteraction) {

            if (interactEvent instanceof MessageComponentInteraction) await interactEvent.update({ content: 'This message is no longer being hosted', components: [], embeds: [] }).catch(console.error)
            else await interactEvent.reply({ content: "This command does not have a handler. Please refrain from trying again.", ephemeral: true }).catch(console.error)

        }

        this.emit(`scrims${event}`, interactEvent)

    }

    async isPermitted(interactEvent) {

        if (!interactEvent.scrimsPermissions) return false;

        const { permissionLevel, allowedPositions, requiredPositions } = interactEvent.scrimsPermissions
        if (!permissionLevel && !allowedPositions && !requiredPositions) return true;
        
        if (!interactEvent.member) return false;
        
        const hasPermission = await interactEvent.member.hasPermission(permissionLevel, allowedPositions, requiredPositions).catch(error => error);
        if (hasPermission instanceof Error) {

            console.error(`Unable to check if user has permission because of ${hasPermission}!`)
            return false;

        }
        return hasPermission;

    }

    async ensureScrimsUser(interactEvent) {

        interactEvent.scrimsUser = await this.database.users.get({ discord_id: interactEvent.user.id }).then(result => result[0] ?? null)
            .catch(error => console.error(`Getting scrims user failed because of ${error}!`, interactEvent.user))
            
        if (!interactEvent.scrimsUser && interactEvent.member) {

            interactEvent.scrimsUser = await this.scrimsUsers.createScrimsUser(interactEvent.member)

        }    

    }

    expandMember(member) {

        member.hasPermission = async (...args) => this.permissions.hasPermission(member, ...args);

    }

    /**
     * @param { discordModals.Modal } modal 
     * @param { Interaction } interaction 
     * @param { discordModals.ModalSubmitField[] } fields 
     */
    async sendModal(modal, interaction, fields=[]) {

        const inputs = modal.components.map(actionRow => actionRow.components[0]).flat()
        fields.forEach(field => {

            const input = inputs.filter(value => value.customId === field.customId)[0]
            if (input) {

                input.value = field.value

            }

        })

        await discordModals.showModal(modal, { client: this, interaction })

    }

    async onInteractEvent(interactEvent, event, allowParials=false) {

        if (interactEvent.partial && !allowParials) interactEvent = await interactEvent.fetch().catch(() => null)
        if (!interactEvent) return false;

        const isCommandInteraction = (interactEvent instanceof CommandInteraction)
        const isComponentInteraction = (interactEvent instanceof MessageComponentInteraction)
        const isModalSumbitInteraction = (interactEvent instanceof discordModals.ModalSubmitInteraction)
        const isInteraction = (interactEvent instanceof Interaction) || isModalSumbitInteraction

        if (interactEvent instanceof Message) this.expandMessage(interactEvent)

        if (isCommandInteraction)  this.expandCommandInteraction(interactEvent)
        if (isComponentInteraction || isModalSumbitInteraction) this.expandComponentInteraction(interactEvent)

        if (isCommandInteraction || isComponentInteraction)
            interactEvent.sendModal = async (modal, fields) => this.sendModal(modal, interactEvent, fields)

        if (interactEvent.user) interactEvent.userId = interactEvent.user.id
        if (interactEvent.commandName === "CANCEL" && isComponentInteraction) 
            return interactEvent.update({ content: `Operation cancelled.`, embeds: [], components: [] });

        if (interactEvent.commandName === "ping" && (interactEvent instanceof CommandInteraction)) 
            return interactEvent.reply({ content: `pong`, embeds: [], components: [], ephemeral: true });

        if (this.blocked && isInteraction && !['killAction', 'kill'].includes(interactEvent.commandName)) {

            if (isCommandInteraction || isComponentInteraction) 
                await interactEvent.reply({ content: 'I am currently restarting. Please try again in a minute.', ephemeral: true });
            
            this.emit('blocked', interactEvent.constructor.name)
            
            return false;

        }

        if (interactEvent instanceof Message || interactEvent instanceof MessageReaction) {

            interactEvent.scrimsUser = this.database.users.cache.find({ discord_id: interactEvent?.user?.id })[0] ?? null;

        }else if (interactEvent.user) await this.ensureScrimsUser(interactEvent)

        if (interactEvent.member instanceof GuildMember) this.expandMember(interactEvent.member)
            
        if (interactEvent instanceof CommandInteraction)
            if (!(await this.isPermitted(interactEvent))) 
                return interactEvent.reply(ResponseTemplates.errorMessage("Insufficient Permissions", "You are missing the required permissions to use this command!")).catch(console.error);
        
        return this.handleInteractEvent(interactEvent, event)
        
    }

    async onReaction(reaction, user, event) {

        reaction.user = user
        return this.onInteractEvent(reaction, event);

    }

    async updateScrimsGuild(oldGuild, newGuild) {

<<<<<<< HEAD
        const existing = this.database.guilds.cache.get(newGuild.id)
=======
        const existing = this.database.guilds.cache.get({ discord_id: newGuild.id })[0]
>>>>>>> main
        if (!existing) {

            return this.database.guilds.create({

                discord_id: newGuild.id,
                name: newGuild.name,
                icon: (newGuild?.icon ?? null)

            }).catch(error => console.error(`Unable to create scrims guild because of ${error}!`));

        }

        if (existing?.name != newGuild.name || existing?.icon != newGuild.icon) {

            await this.database.guilds.update({ discord_id: newGuild.id }, { name: newGuild.name, icon: (newGuild?.icon ?? null) })
                .catch(error => console.error(`Unable to update scrims guild because of ${error}!`))

        }

    }

    addEventListeners() {

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
