const { GuildChannel } = require("discord.js")

const UPDATE_TIME_LIMIT = 10*60*1000
const UPDATE_AMMOUNT_LIMIT = 2

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

        this.recentRequests = []
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
        this.waitTimer = setTimeout(() => this.setName(name).catch(console.error), ms)

    }

    getTimeout() {

        this.recentRequests = this.recentRequests.filter(v => (v+UPDATE_TIME_LIMIT) >= Date.now())
        if (this.recentRequests.length >= UPDATE_AMMOUNT_LIMIT) 
            return Math.max(...this.recentRequests.map(v => (v+UPDATE_TIME_LIMIT))) - Date.now();

        return null;

    }

    async setName(name) {

        this.recentRequests.push(Date.now())
        if (this.channel) await this.channel.setName(name)

    }

    async update(name) {

        if (!this.channel) return false;
        if (this.channel.name === name) return true;

        const timeout = this.getTimeout()
        if (timeout) this.postponeUpdate(timeout, name)
        else await this.setName(name)

    }

}

module.exports = StatusChannel;