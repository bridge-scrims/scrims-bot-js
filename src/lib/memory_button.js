const { MessageButton, SnowflakeUtil, Message } = require('discord.js');

class MemoryMessageButton extends MessageButton {

    /**
     * @type { MemoryMessageButton[] }
     */
    static buttons = []

    static getHandler(id) {

        return this.buttons
            .filter(button => button.customId === id && button.responseCustomId)
            .map(button => (async interaction => button.onClick(interaction)))[0]

    }

    /**
     * @param { Message } message 
     */
    static destroyMessage(message) {

        if (message?.components) {

            const buttons = Object.fromEntries(this.buttons.map(button => [button.customId, button]))
            message.components.map(actionRow => actionRow.components).flat().forEach(component => buttons[component.customId]?.destroy())

        }

    }

    constructor(client, data) {

        super()

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @type { import('./bot') }
         * @readonly
         */
        this.client

        /**
         * @type { number }
         */
        this.creation = Date.now()

        this.customId = SnowflakeUtil.generate()
        this.client.handles.push(this.customId)
        setTimeout(() => this.releaseHandle(), 45*1000)
        this._buttonTimeout = setTimeout(() => this.destroy(), 15*60*1000)

        this.data = data

        MemoryMessageButton.buttons.push(this)

    }

    getLifeTime() {

        return Date.now() - this.creation;

    }

    destroy() {

        if (this._buttonTimeout) clearTimeout(this._buttonTimeout)
        this._buttonTimeout = null
        
        this.releaseHandle()

        MemoryMessageButton.buttons =  MemoryMessageButton.buttons.filter(value => value !== this)

    }

    releaseHandle() {

        this.client.handles = this.client.handles.filter(v => v !== this.customId)

    }

    /**
     * @override
     */
    setCustomId(customId) {
  
        this.responseCustomId = customId
        return this;

    }

    async onClick(interaction) {

        interaction.memoryData = this.data
        interaction.customId = this.responseCustomId
        this.client.expandComponentInteraction(interaction)

        await this.client.handleInteractEvent(interaction, 'InteractionCreate')

    }

}

module.exports = MemoryMessageButton;