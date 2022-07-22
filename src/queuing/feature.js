const { commandHandler, commands } = require("./commands");

class ScrimsQueuingFeature {

    constructor(bot) {

        Object.defineProperty(this, 'bot', { value: bot });

        /** 
         * @type {import("../bot")} 
         * @readonly
         */
        this.bot

        commands.forEach(([command, cmdPerms, cmdConfig]) => this.bot.commands.add(command, commandHandler, cmdPerms, cmdConfig))

    }

    get database() {
        return this.bot.database;
    }

}

module.exports = ScrimsQueuingFeature