const { SnowflakeUtil, MessageActionRow, MessageButton } = require("discord.js");

/**
 * @callback getResponseCall
 * @param { number } currentIndex
 * @returns { Promise<import('../types').EphemeralExchangeResponse> }
 */

class EphemeralExchange {

    constructor(client, guild, creator, getResponseCall) {

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @type { import('../bot') }
         * @readonly
         */
        this.client

        /**
         * @type { number }
         */
        this.currentIndex = 0

        /** @type {ScrimsUser} */
        this.creator = creator

        /** @type {Guild} */
        this.guild = guild

        /**
         * @type { getResponseCall }
         */
        this.getResponseCall = getResponseCall

        this.customId = SnowflakeUtil.generate()
        this.client.limitedComponents.add(this, 30*60*1000)

    }

    destroy() {

        this.client.limitedComponents.destroy(this.customId)

    }

    getNextButton(label='Continue') {

        if (label === false) return false;
        return new MessageButton()
            .setLabel(label).setCustomId(`${this.customId}/NEXT`).setStyle('SUCCESS');

    }

    getBackButton(label='Back') {

        if (label === false) return false;
        return new MessageButton()
            .setLabel(label).setCustomId(`${this.customId}/BACK`).setStyle('SECONDARY').setDisabled(this.currentIndex <= 0);

    }

    getCancelButton(label='Cancel') {

        if (label === false) return false;
        return new MessageButton()
            .setLabel(label).setCustomId(`${this.customId}/CANCEL`).setStyle('DANGER');

    }

    getButtons(response) {
        return [this.getNextButton(response.nextOption), this.getBackButton(response.backOption), this.getCancelButton(response.cancelOption)].filter(v => v);
    }

    async getResponse() {

        const response = await this.getResponseCall(this.currentIndex)
        if (!response) return null;

        const buttons = this.getButtons(response)
        if (buttons.length > 0 && this.currentIndex >= 0) response.components = [new MessageActionRow().addComponents(...buttons)]
        else response.components = []

        return { ...response, ephemeral: true };

    }


    /**
     * @param { import('../types').ScrimsComponentInteraction } interaction
     */
    async onInteract(interaction) {

        await interaction.deferUpdate()

        const action = interaction.args.shift()

        if (action === 'NEXT') this.currentIndex += 1
        if (action === 'BACK') this.currentIndex -= 1
        if (action === 'CANCEL') this.currentIndex = -1

        const response = await this.getResponse()
        if (response) await interaction.editReply(response)

        if (this.currentIndex === -1) this.destroy()

    }

    /**
     * @param { import('../types').ScrimsCommandInteraction | import('../types').ScrimsComponentInteraction } interaction
     */
    async send(interaction) {

        const response = await this.getResponse()
        if (response) await interaction.reply(response)

    }

}

module.exports = EphemeralExchange;