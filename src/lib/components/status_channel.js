const { GuildChannel, RateLimitError } = require("discord.js");
const AsyncFunctionBuffer = require("../tools/buffer");

class StatusChannel {

    constructor(channel) {

        /** @type { string } */
        this.id = channel.id

        /** @type { GuildChannel } */
        this.channel = channel

        this.channelDeleteCall = (channel) => {
            if (channel.id === this.id) this.destroy();
        }
        this.channel.client.on('channelDelete', this.channelDeleteCall)

        this.updateBuffer = new AsyncFunctionBuffer((name) => this._setName(name), 0)
        this.timeoutEnd = -1
        this.waitTimer = null

    }

    get guildId() {
        return this.channel?.guildId ?? null;
    }

    destroy() {

        this.channel?.client?.off('channelDelete', this.channelDeleteCall)
        this.channel = null
        if (this.waitTimer) clearTimeout(this.waitTimer)

    }

    postponeUpdate(ms, name) {

        if (this.waitTimer) clearTimeout(this.waitTimer)
        const timeout = setTimeout(() => this.updateBuffer.run(name).catch(console.error), ms)
        this.waitTimer = timeout

    }

    async _setName(name) {

        if (this.channel) await this.channel.setName(name)

        /*
        try {
            if (this.channel) await this.channel.setName(name)
        }catch (error) {
            if (error instanceof RateLimitError) {
                this.timeoutEnd = error.timeout + Date.now()
                this.postponeUpdate(error.timeout, name)
            }else {
                throw error;
            }
        }
        */

    }

    async update(name) {

        if (!this.channel) return false;
        if (this.channel.name === name) return true;

        await this.updateBuffer.run(name)
        /*
        if (this.timeoutEnd > Date.now()) this.postponeUpdate(this.timeoutEnd-Date.now(), name)
        else await this.updateBuffer.run(name)
        */

    }

}

module.exports = StatusChannel;