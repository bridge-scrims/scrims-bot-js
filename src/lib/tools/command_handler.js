const { Interaction, CommandInteraction, AutocompleteInteraction, MessageComponentInteraction } = require("discord.js");
const ScrimsMessageBuilder = require("../responses.js");
const I18n = require("./internationalization.js");
const UserError = require("./user_error.js");

class ScrimsCommandHandler {

    constructor(installer) {

        /** @type {import("./command_installer.js")} */
        this.installer = installer

        this.handlers = {}

    }

    get bot() {
        return this.installer.bot;
    }

    get database() {
        return this.bot.database;
    }

    addHandler(id, handler) {
        this.handlers[id] = handler
    }

    /** @param {Interaction} interaction */
    async handleInteraction(interaction) {

        interaction.database = this.database
        interaction.i18n = I18n.getInstance(interaction.locale)

        if (interaction.isApplicationCommand()) this.expandCommandInteraction(interaction)
        if (interaction.isMessageComponent() || interaction.isModalSubmit()) this.expandComponentInteraction(interaction)

        interaction.commandConfig = this.installer.getScrimsCommandConfiguration(interaction.commandName) ?? null
        interaction.scrimsPermissions = this.installer.getScrimsCommandPermissions(interaction.commandName) ?? null

        if (interaction.isApplicationCommand() || interaction.isMessageComponent())
            interaction.sendModal = async (modal, fields) => this.sendModal(modal, interaction, fields)

        if (!interaction.isAutocomplete())
            interaction.send = async (payload) => {
                if (interaction.replied || interaction.deferred) return interaction.editReply(payload);
                return interaction.reply(payload);
            }

        this.bot.expandUser(interaction.user)
        if (interaction.user.scrimsUser) interaction.scrimsUser = interaction.user.scrimsUser
        interaction.userId = interaction.user.id

        if (interaction.commandName === "CANCEL" && interaction.isMessageComponent()) 
            return interaction.update({ content: interaction.i18n.get('operation_cancelled'), embeds: [], components: [] });

        if (interaction.commandName === "ping" && interaction.isApplicationCommand()) 
            return interaction.reply({ content: `pong`, embeds: [], components: [], ephemeral: true });

        if (
            this.bot.blocked && (interaction?.commandConfig?.denyWhenBlocked)
            && (this.bot.handles.indexOf(interaction.id) === -1) && (this.bot.handles.indexOf(interaction.commandName) === -1)
            && !(interaction.commandName === "killAction")
        ) {

            if (interaction.isAutocomplete()) await interaction.respond([]).catch(console.error);
            else await interaction.reply({ content: interaction.i18n.get('blocked_cancel'), ephemeral: true }).catch(console.error);

            this.bot.emit('blocked', interaction.constructor.name)
            return false;

        }

        if (interaction.member) this.bot.expandMember(interaction.member)
        if (!interaction.scrimsUser) {
            if (interaction?.commandConfig?.forceScrimsUser) {
                interaction.scrimsUser = await this.database.users.find({ discord_id: interaction.user.id }).catch(console.error)
                
                if (interaction.scrimsUser) {
                    if (interaction.member) this.bot.expandMember(interaction.member, interaction.scrimsUser)
                    this.bot.expandUser(interaction.user, interaction.scrimsUser)
                }

                if (interaction.scrimsUser === null) {
                    await this.bot.scrimsUsers.createScrimsUser(interaction.member ?? interaction.user).catch(console.error)
                    interaction.scrimsUser = interaction.user.scrimsUser
                }

                if (!interaction.user.scrimsUser) {
                    if (!interaction.isAutocomplete()) 
                        await interaction.reply(ScrimsMessageBuilder.scrimsUserNeededMessage(interaction.i18n)).catch(console.error);
                    return false;
                }
            }
        }

        await this.expandInteractionMember(interaction)

        if (interaction.user && interaction.scrimsUser) 
            this.bot.scrimsUsers.update(interaction.user, interaction.scrimsUser).catch(console.error)
            
        if (!this.isPermitted(interaction)) {
            if (interaction.isApplicationCommand() || interaction.isModalSubmit()) 
                await interaction.send(ScrimsMessageBuilder.missingPermissionsMessage(interaction.i18n, interaction.i18n.get('missing_command_permissions'))).catch(console.error);
            return false;
        }
            
        if (interaction?.commandConfig?.forceGuild && !interaction.guild) {

            if (!interaction.isAutocomplete()) 
                await interaction.reply(ScrimsMessageBuilder.guildOnlyMessage(interaction.i18n)).catch(console.error);

            return false;

        }

        return this.callInteractionHandler(interaction)

    }

    /** @param {Interaction} interaction */
    async callInteractionHandler(interaction) {

        const handler = this.bot.limitedComponents.getHandler(interaction.commandName) || this.handlers[interaction.commandName]
        if (handler) return this.runHandler(handler, interaction);

        if (interaction.isMessageComponent()) await interaction.update({ content: interaction.i18n.get('message_not_hosted'), components: [], embeds: [] }).catch(console.error)
        else if (interaction.isAutocomplete()) await interaction.respond([]).catch(console.error)
        else await interaction.reply({ content: interaction.i18n.get('missing_command_handler'), ephemeral: true }).catch(console.error)

    }

    async runHandler(handler, interaction) {

        const id = interaction?.id || `${Date.now()}`
        if (!this.bot.handles.indexOf(id)) this.bot.handles.push(id)

        try {

            const defer = interaction?.commandConfig?.ephemeralDefer
            if (defer !== undefined && !(interaction instanceof AutocompleteInteraction)) 
                await interaction.deferReply({ ephemeral: defer })
            await handler(interaction)

        }catch(error) {

            // Fail safe for unexpected command handler errors e.g. database errors

            if (!['Unknown interaction', 'The user aborted a request.'].includes(error.message) && !(error instanceof UserError))
                console.error(`Unexpected error while handling a command!`, error)

            if (!(interaction.isAutocomplete())) {

                if (interaction.isModalSubmit())
                    if (!interaction.replied && !interaction.deferred) await interaction.deferReply({ ephemeral: true }).catch(() => null)

                const payload = this.getErrorPayload(interaction.i18n, error)

                if (interaction.replied || interaction.deferred) await interaction.editReply(payload).catch(() => null)
                else await interaction.reply(payload).catch(() => null)

            }

        }

        this.bot.handles = this.bot.handles.filter(v => v !== id)

    }

    /**
     * @param {I18n} i18n 
     * @param {Error} error
     */
    getErrorPayload(i18n, error) {

        if (error instanceof UserError) return error.toMessage();
        if (error?.code == 'ECONNREFUSED') return ScrimsMessageBuilder.errorMessage(i18n.get('command_failed_title'), i18n.get('command_failed'));
        return ScrimsMessageBuilder.errorMessage(i18n.get('unexpected_error_title'), i18n.get('unexpected_error'));

    }

    expandCommandInteraction(cmdInteraction) {

        cmdInteraction.params = cmdInteraction.options

    }

    expandComponentInteraction(interaction) {

        interaction.args = interaction.customId.split("/") || []
        interaction.commandName = interaction.args.shift() || null 

    }

    isPermitted(interaction) {

        if (!interaction.scrimsPermissions) return true;
        if (!interaction.scrimsPositions) return false;

        if (interaction.member) 
            return interaction.member.hasPermission(interaction.scrimsPermissions);

        return interaction.scrimsPositions.hasPermission(interaction.scrimsPermissions);

    }

    async expandInteractionMember(interation) {

        if (interation.scrimsUser) {
            interation.scrimsPositions = await interation.scrimsUser.fetchPositions() 
            interation.user.scrimsPositions = interation.scrimsPositions
        }

        if (interation.member) {
            interation.member.scrimsPositions = interation.scrimsPositions
            interation.member.hasPermission = (scrimsPermissions) => this.bot.permissions.hasPermission(interation.scrimsPositions, interation.member, scrimsPermissions);
        }

    }

    /**
     * @param {Modal} modal 
     * @param {MessageComponentInteraction|CommandInteraction} interaction 
     * @param {TextInputComponent[]} fields 
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

}

module.exports = ScrimsCommandHandler;