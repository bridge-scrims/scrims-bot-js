
/**
 * @callback setCallback
 * @param { string } guild_id
 * @param { string } value
 * @returns { Promise<any> }
 */

/**
 * @callback rmvCallback
 * @param { string } guild_id
 * @param { string } value
 * @returns { Promise<any> }
 */

class DynamicallyConfiguredValueUpdater {

    /**
     * 
     * @param { import("../bot").ScrimsCouncilBotDBClient } database 
     * @param { string } typename 
     * @param { setCallback } setCallback 
     * @param { rmvCallback } rmvCallback 
     */
    constructor(bot, typename, setCallback, rmvCallback) {

        /** @type {import("../bot")} */
        this.bot = bot

        //Adding the config type if it does not exist
        if (!this.database.guildEntryTypes.cache.find({ name: typename })) {
            this.database.guildEntryTypes.create({ name: typename }).catch(console.error)
        }

        const isCorrectType = (entry) => (entry.type.name === typename) && (this.bot.guilds.cache.has(entry.guild_id));
        this.pushCallback = (entry) => isCorrectType(entry) ? setCallback(entry.guild_id, entry.value).catch(console.error) : null;
        this.updateCallback = (entry) => isCorrectType(entry) ? setCallback(entry.guild_id, entry.value).catch(console.error) : null;
        this.removeCallback = (entry) => isCorrectType(entry) ? rmvCallback(entry.guild_id, entry.value).catch(console.error) : null;
        
        this.database.guildEntrys.cache.on('push', this.pushCallback)
        this.database.guildEntrys.cache.on('update', this.updateCallback)
        this.database.guildEntrys.cache.on('remove', this.removeCallback)
        
        const configured = this.database.guildEntrys.cache.values().filter(entry => isCorrectType(entry))
        Promise.allSettled(configured.map(entry => setCallback(entry.guild_id, entry.value).catch(console.error)))

    }

    get database() {

        return this.bot.database;

    }

    destroy() {

        this.database.guildEntrys.cache.off('push', this.pushCallback)
        this.database.guildEntrys.cache.off('update', this.updateCallback)
        this.database.guildEntrys.cache.off('remove', this.removeCallback)

    }

}

module.exports = DynamicallyConfiguredValueUpdater;