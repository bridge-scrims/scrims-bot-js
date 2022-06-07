const { MessageButton, SnowflakeUtil } = require('discord.js');

class MemoryMessageButton extends MessageButton {

    constructor(client, data) {

        super()

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @type { import('../bot') }
         * @readonly
         */
        this.client

        /**
         * @type { number }
         */
        this.creation = Date.now()

        this.customId = SnowflakeUtil.generate()
        this.data = data

        this.client.limitedComponents.add(this, 15*60*1000)

    }

    getLifeTime() {

        return Date.now() - this.creation;

    }

    /**
     * @override
     */
    setCustomId(customId) {
  
        this.responseCustomId = customId
        return this;

    }

    async onInteract(interaction) {

        interaction.memoryData = this.data
        interaction.customId = this.responseCustomId
        this.client.expandComponentInteraction(interaction)

        await this.client.handleInteractEvent(interaction, 'InteractionCreate')

    }

}

module.exports = MemoryMessageButton;