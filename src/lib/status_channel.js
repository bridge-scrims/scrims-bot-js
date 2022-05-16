const { GuildChannel } = require("discord.js")

const UPDATE_TIME_LIMIT = 1000*60*10
const UPDATE_AMMOUNT_LIMIT = 2

class StatusChannel {

    constructor(channel) {

        /**
         * @type { GuildChannel }
         */
        this.channel = channel

        this.recentRequests = []
        this.waitTimer = null

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
        await this.channel.setName(name)

    }

    async update(name) {

        if (this.channel.name === name) return true;

        const timeout = this.getTimeout()
        if (timeout) this.postponeUpdate(timeout, name)
        else await this.setName(name)

    }

}

module.exports = StatusChannel;