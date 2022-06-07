const { TextInputComponent, Modal, MessageOptions, MessageActionRow, MessageEmbed, MessageButton, MessageFlags } = require("discord.js");
const ScrimsMessageBuilder = require("../responses");
const EphemeralExchange = require("./exchange");

/**
 * @callback getModalResponseCall
 * @param { MessageEmbed } embed
 * @param { import('../types').EphemeralExchangeInputField[] } fields
 * @param { number } currentIndex
 * @returns { MessageOptions }
 */

/**
 * @callback onFinish
 * @param { ModalEphemeralExchange } exchange
 * @returns { Promise<MessageOptions|void> }
 */

class ModalEphemeralExchange extends EphemeralExchange {

    /**
     * @param { string } title
     * @param { import('../types').EphemeralExchangeInputField[] } fields 
     */
    constructor(client, guild, creator, title, fields, getModalResponseCall, onFinish) {

        super(client, guild, creator, () => this.getModalResponse())

        /**
         * @type { string }
         */
        this.title = title

        /**
         * @type { import('../types').EphemeralExchangeInputField[] } 
         */
        this.fields = fields

        /**
         * @type { getModalResponseCall }
         */
        this.getModalResponseCall = getModalResponseCall

        /**
         * @type { onFinish }
         */
        this.onFinish = onFinish

    }

    get length() {

        return Math.ceil(this.fields.length / 5);

    }

    getValue(customId) {

        return this.fields.find(v => v.customId === customId)?.value ?? null;

    }

    getEmbedFields() {

        return this.fields
            .filter(field => field.value !== undefined)
            .map(field => ({ name: field.label, value: this.stringifyFieldValue(field.type, field.value).substring(0, 1024) }));

    }

    async getModalResponse() {

        const embed = new MessageEmbed()
            .setFooter({ text: `${this.title}  •  ${this.currentIndex+1}/${this.length}` })
            .setFields(this.getEmbedFields())

        return this.getModalResponseCall(embed, this.fields, this.currentIndex);          

    }

    /**
     * @override
     */
    getNextButton(...args) {

        if (this.currentIndex+1 < this.length) return super.getNextButton(...args);
        
        return new MessageButton()
            .setLabel('Submit').setCustomId(`${this.customId}/NEXT`).setStyle('SUCCESS');

    }

    getEditButton() {

        return new MessageButton()
            .setLabel('Edit').setCustomId(`${this.customId}/EDIT`).setStyle('PRIMARY').setEmoji('🖊️');

    }

    getButtons(response) {
        return [this.getNextButton(response.nextOption), this.getEditButton(), this.getBackButton(response.backOption), this.getCancelButton(response.cancelOption)].filter(v => v);
    }

    /**
     * @param { import('../types').InputType } type
     * @param { any } value
     */
    stringifyFieldValue(type, value) {

        if (type === 'USERS') 
            return (value.length > 0) ? value.map(v => (v?.id || v?.discord_id) ? `${v} (${v?.discord_id ?? v?.id})` : `**${v}**`).map(v => `\`•\` ${v}`).join("\n") : '``` ```';
        
        return `\`\`\`${ScrimsMessageBuilder.stripText(value)}\`\`\``;

    }

    /**
     * @param { import('../types').InputType } type
     * @param { any } value
     */
    modalifyFieldValue(type, value) {

        if (type === 'USERS') 
            return (value.length > 0) ? value.map(v => v?.tag ? `@${v?.tag}` : `@${v}`).join(' ') : '';
        
        return `${value}`;

    }

    async parseDiscordUsers(guild, text) {

        if (!text) return [];
        text = text.replace(/\n/g, '@').replace(/```|:|discord/g, '')

        const scrimsUsers = this.client.database.users.cache.values()
        const userResolvables = text.split('@').map(v => v.trim()).filter(v => v.length > 0).slice(0, 10)

        return userResolvables.map(resolvable => (ScrimsMessageBuilder.parseUser(resolvable, scrimsUsers, guild)) ?? `${resolvable}`);

    }

    /**
     * @param { import('../types').InputType } type
     * @param { Promise<string> } value
     */
    async parseFieldValue(interaction, type, value) {

        if (type === 'USERS') return this.parseDiscordUsers(interaction.guild, value);
        return value;

    }

    async parseFieldValues(interaction) {

        await Promise.all(
            interaction.components.map(v => v.components).flat().map(async (partialField) => {

                const field = this.fields.find(field => field.customId === partialField.customId)
                if (field) {

                    field.value = await this.parseFieldValue(interaction, field.type, partialField.value)

                }

            })
        )

    }

    /**
     * @param { import('../types').ScrimsModalSubmitInteraction } interaction
     */
    async onModalSubmit(interaction) {

        await this.parseFieldValues(interaction)
        
        const response = await this.getResponse()
        if (response) {
            if (interaction.message.flags?.has(MessageFlags.FLAGS.EPHEMERAL)) await interaction.update(response)
            else await interaction.reply(response)
        }

    }

    /**
     * @override
     * @param { import('../types').ScrimsInteraction } interaction
     */
    async onInteract(interaction) {

        if (interaction.args[0] === 'CANCEL') return super.onInteract(interaction);

        const action = interaction.args.shift()

        if (action === 'MODAL') return this.onModalSubmit(interaction);

        if (action === 'NEXT') this.currentIndex += 1
        if (action === 'BACK') this.currentIndex -= 1

        if (action === 'EDIT') {
            if (this.getModal()) await interaction.sendModal(this.getModal())
            return false;
        }

        if (this.currentIndex+1 >= this.length) {

            await interaction.update({ content: `Sending...`, components: [], embeds: [] })
            const result = await this.onFinish(this);

            if (typeof result === "object") await interaction.editReply(result).catch(console.error)
            this.destroy()

        }
        
    }

    /**
     * @param { import('../types').EphemeralExchangeInputField } field
     * @returns { TextInputComponent }
     */
    getTextInputComponent(field) {

        if (!field.type) field.type = 'TEXT'
        if (field.value !== undefined) field.value = this.modalifyFieldValue(field.type, field.value)
        return new TextInputComponent(field);

    }

    getModal() {

        const fields = this.fields.slice(this.currentIndex*5, this.currentIndex*5+5).filter(v => v)
        if (fields.length === 0) return null;
 
        return new Modal()
            .setTitle(this.title)
            .setCustomId(`${this.customId}/MODAL`)
            .addComponents(fields.map(field => new MessageActionRow().addComponents(this.getTextInputComponent({ ...field }))))

    }

    /**
     * @override
     * @param { import('../types').ScrimsCommandInteraction | import('../types').ScrimsComponentInteraction } interaction
     */
    async send(interaction) {

        await interaction.sendModal(this.getModal())
    
    }

}

module.exports = ModalEphemeralExchange;