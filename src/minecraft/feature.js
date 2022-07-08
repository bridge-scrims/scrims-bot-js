const { GuildMember, Role, Guild } = require("discord.js");
const { commands, commandHandler } = require("./commands");

class MinecraftFeature {

    constructor(bot) {

        /** @type {import("../bot")} */
        this.bot = bot


        commands.forEach(([ cmdData, cmdPerms, cmdOptions ]) => this.bot.commands.add(cmdData, commandHandler, cmdPerms, cmdOptions))
        this.bot.commands.add("minecraft", commandHandler, {}, { denyWhenBlocked: true })


        bot.on('databaseConnected', () => this.onStartup())

    }

    get database() {

        return this.bot.database;

    }

    async onStartup() {
        
        this.addEventHandlers()

    }

    addEventHandlers() {
    

    }
    
}

module.exports = MinecraftFeature;