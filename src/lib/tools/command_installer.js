const { ContextMenuCommandBuilder, SlashCommandBuilder } = require('@discordjs/builders');
const { ApplicationCommand, Collection } = require('discord.js');
const ScrimsCommandHandler = require('./command_handler');

class ScrimsCommandInstaller {

    constructor(bot) {

        /** @type {import("../bot")} */
        this.bot = bot

        /** @type {ScrimsCommandHandler} */
        this.handler = new ScrimsCommandHandler(this)

        /** @type {(SlashCommandBuilder|ContextMenuCommandBuilder)[]} **/
        this.appCommandBuilders = []

        /** @type {Collection<string, ApplicationCommand<{ guild: GuildResolvable }>>} **/
        this.appCommands = []

        /**@type {Object.<string, [import('../types').ScrimsPermissions, import('../types').ScrimsCommandConfiguration]>} */
        this.commands = {}

        this.bot.on('interactionCreate', interaction => this.handler.handleInteraction(interaction).catch(console.error))

    }

    async initializeCommands() {

        this.appCommands = await this.bot.application.commands.fetch()
        await this.update()

    }

    setScrimsCommandDefaultPermission(scrimsCommand, scrimsPermissions, guilds) {

        const guildPermissions = guilds.map(guild => this.getCommandPermissionsGuildCommandPermissions(guild, scrimsPermissions))
        const defaultPermission = guildPermissions.some(perms => perms.length > 10) || guildPermissions.every(perms => perms.length === 0)
        scrimsCommand.setDefaultPermission(defaultPermission)

    }

    async update() {

        await this.updateCommands()
        //await this.updateCommandsPermissions()

    }

    /**
     * @param {string|ContextMenuCommandBuilder|SlashCommandBuilder} commandData
     * @param {import('../types').ScrimsPermissions} commandPermissionData
     * @param {import('../types').ScrimsCommandConfiguration} cmdConfig 
     */
    add(commandData, commandHandler, commandPermissionData={}, cmdConfig={}) {

        if (typeof commandData !== "string") {

            const options = commandData.options
        
            // Important so that we can tell if the command changed or not
            if (options) options.filter(option => (!option.type)).forEach(option => option.type = "SUB_COMMAND")
            if (options) options.filter(option => (option?.options?.length === 0)).forEach(option => option.options = undefined)

            this.appCommandBuilders.push(commandData)

        }

        const id = commandData?.name ?? commandData

        this.handler.addHandler(id, commandHandler)
        this.commands[id] = [commandPermissionData, cmdConfig]
        
    }

    getCommandBuilder(name) {
        return this.appCommandBuilders.find(v => v.name === name) ?? null;
    }

    getScrimsCommandPermissions(name) {
        return this.commands[name]?.[0] ?? null;
    }

    getScrimsCommandConfiguration(name) {
        return this.commands[name]?.[1] ?? null;
    }

    async updateCommands() {

        // UPDATING
        await Promise.all(this.appCommands.map(appCmd => this.updateAppCommand(appCmd)))

        // ADDING NEW
        await Promise.all(this.appCommandBuilders.map(builder => this.addAppComand(builder)))

        // RELOADING
        this.appCommands = await this.bot.application.commands.fetch()
        
    }

    async updateAppCommand(appCmd) {

        const builder = this.getCommandBuilder(appCmd.name)

        if (appCmd && builder) {

            if (!appCmd.equals(builder))
                // update command
                await this.bot.application.commands.edit(appCmd.id, builder)
                    .catch(error => console.error(`Unable to edit app command with id ${appCmd.id}!`, newScrimsCommand, error))

        }

        if (appCmd && !builder) {

            await this.bot.application.commands.delete(appCmd.id)
                .catch(error => console.error(`Unable to delete app command with id ${appCmd.id}!`, error))
        
        }
            
    }

    async addAppComand(builder) {

        if (this.appCommands.find(cmd => cmd.name === builder.name)) return false;

        await this.bot.application.commands.create(builder)
            .catch(error => console.error(`Unable to create app command!`, builder, error))

    }
    
    
    async updateCommandsPermissions() {

        const guilds = await this.bot.guilds.fetch()
        for (const guild of guilds.values()) await this.updateGuildCommandsPermissions(guild)

    }

    async updateGuildCommandsPermissions(guild) {

        await Promise.all(this.appCommands.map(appCmd => this.updateCommandPermissions(guild, appCmd))).catch(console.error)

    }

    getCommandPermissionsGuildCommandPermissions(guild, perms) {

        return [];
        
        const positions = this.bot.permissions.getCommandAllowedPositions(perms)
        if (positions.length === 0) return [];

        const roles = positions.map(position => this.bot.permissions.getPositionRequiredRoles(guild.id, position)).flat()
        
        if (roles.length === 0) return [{ id: guild.id, permission: true, type: 'ROLE' }];
        return roles.map(roleId => ({ id: roleId, permission: true, type: 'ROLE' }))

    }

    async updateCommandPermissions(guild, appCmd) {

        const scrimsCommandPermissions = this.getScrimsCommandPermissions(appCmd.name)
        const permissions = this.getCommandPermissionsGuildCommandPermissions(guild, scrimsCommandPermissions)

        const existingPerms = await appCmd.permissions.fetch({ command: appCmd.id, guild: guild.id }).catch(() => null)

        // Permissions have not changed so just leave it
        if (!existingPerms && permissions.length === 0) return true;
        if ((JSON.stringify(existingPerms) == JSON.stringify(permissions))) return true;
        
        // Can not block the command client side, since discord only allows up to 10 permissions
        if (appCmd.defaultPermission || permissions.length === 0 || permissions.length > 10) {

            await appCmd.permissions.set({ command: appCmd.id, guild: guild.id, permissions: [] })
                .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id}/${guild.id} to none!`, error))
            
            return false; 

        }

        // Set command permissions
        await appCmd.permissions.set({ command: appCmd.id, guild: guild.id, permissions })
            .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id}/${guild.id}!`, permissions, error))

    }



}

module.exports = ScrimsCommandInstaller;