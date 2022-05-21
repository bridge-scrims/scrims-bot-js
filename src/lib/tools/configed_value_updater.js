
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
    constructor(database, typename, setCallback, rmvCallback) {

        this.database = database

        //Adding the config type if it does not exist
        if (this.database.guildEntryTypes.cache.get({ name: typename }).length === 0) {
            this.database.guildEntryTypes.create({ name: typename }).catch(console.error)
        }

        const isCorrectType = (entry) => (entry.type.name === typename);
        this.pushCallback = (entry) => isCorrectType(entry) ? setCallback(entry.guild_id, entry.value).catch(console.error) : null;
        this.updateCallback = (entry) => isCorrectType(entry) ? setCallback(entry.guild_id, entry.value).catch(console.error) : null;
        this.removeCallback = (entry) => isCorrectType(entry) ? rmvCallback(entry.guild_id, entry.value).catch(console.error) : null;
        
        this.database.guildEntrys.cache.on('push', this.pushCallback)
        this.database.guildEntrys.cache.on('update', this.updateCallback)
        this.database.guildEntrys.cache.on('remove', this.removeCallback)
        
        const configured = this.database.guildEntrys.cache.get({ type: { name: typename } })
        Promise.allSettled(configured.map(entry => setCallback(entry.guild_id, entry.value).catch(console.error)))

    }

    destroy() {

        this.database.guildEntrys.cache.off('push', this.pushCallback)
        this.database.guildEntrys.cache.off('update', this.updateCallback)
        this.database.guildEntrys.cache.off('remove', this.removeCallback)

    }

}

module.exports = DynamicallyConfiguredValueUpdater;