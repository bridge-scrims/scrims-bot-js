const { ContextMenuCommandBuilder, SlashCommandBuilder } = require('@discordjs/builders');

class ScrimsCommandInstaller {

    constructor(bot) {

        /**
         * @type { import("./bot") }
         */
        this.bot = bot

        /**
         * @type { [ SlashCommandBuilder | ContextMenuCommandBuilder, import('./types').ScrimsPermissions, import('./types').ScrimsCommandConfiguration ][] }
         */
        this.cmdData = []

        this.appCommands = []

        this.bot.on('guildCreate', guild => this.onGuildCreate(guild))

    }

    async onGuildCreate(guild) {

        await this.updateGuildCommandsPermissions(guild)

    }

    async initializeCommands() {

        this.appCommands = await this.bot.application.commands.fetch()
        
        await this.update()

    }

    setScrimsCommandDefaultPermission(scrimsCommand, scrimsPermissions, guilds) {

        const guildPermissions = guilds.map(guild => this.getCommandPermissionsGuildCommandPermissions(guild, scrimsPermissions))
        const defaultPermission = guildPermissions.some(perms => perms.length > 10) || guildPermissions.every(perms => perms.length === 0)
        scrimsCommand.defaultPermission = (defaultPermission)

    }

    async update() {

        const guilds = await this.bot.guilds.fetch()
        this.cmdData.forEach(([ cmd, perms ]) => this.setScrimsCommandDefaultPermission(cmd, perms, guilds))
        
        await this.updateCommands()
        await this.updateCommandsPermissions()

    }

    /**
     * @param { import('./types').ScrimsPermissions } commandPermissionData
     * @param { import('./types').ScrimsCommandConfiguration } cmdConfig 
     */
    add(commandData, commandPermissionData={}, cmdConfig={}) {

        const options = commandData.options
        
        // Important so that we can tell if the command changed or not
        if (options) options.filter(option => (!option.type)).forEach(option => option.type = "SUB_COMMAND")
        if (options) options.filter(option => (option?.options?.length === 0)).forEach(option => option.options = undefined)

        this.cmdData.push([ commandData, commandPermissionData, cmdConfig ])

    }

    getScrimsCommand(name) {

        const scrimsCommand = this.cmdData.filter(([cmd, _]) => cmd.name === name)[0];
        if (scrimsCommand) return scrimsCommand[0];
        return null;

    }

    getScrimsCommandPermissions(name) {

        const scrimsCommand = this.cmdData.filter(([cmd, _]) => cmd.name === name)[0];
        if (scrimsCommand) return scrimsCommand[1];
        return null;

    }

    getScrimsCommandConfiguration(name) {

        const scrimsCommand = this.cmdData.filter(([cmd, _]) => cmd.name === name)[0];
        if (scrimsCommand) return scrimsCommand[2];
        return null;

    }

    async updateCommands() {

        // UPDATING
        await Promise.all( this.appCommands.map(appCmd => this.updateAppCommand(appCmd)) )

        // ADDING NEW
        await Promise.all( this.cmdData.map(([cmdData, _]) => this.addAppComand(cmdData)) )

        // RELOADING
        this.appCommands = await this.bot.application.commands.fetch()
        
    }

    async updateAppCommand(appCmd) {

        const scrimsCommand = this.getScrimsCommand(appCmd.name)

        if (appCmd && scrimsCommand) {

            if (!appCmd.equals(scrimsCommand))
                // update command
                await this.bot.application.commands.edit(appCmd.id, scrimsCommand)
                    .catch(error => console.error(`Unable to edit app command with id ${appCmd.id}!`, newScrimsCommand, error))

        }

        if (appCmd && !scrimsCommand) {

            await this.bot.application.commands.delete(appCmd.id)
                .catch(error => console.error(`Unable to delete app command with id ${appCmd.id}!`, error))
        
        }
            
    }

    async addAppComand(scrimsCommand) {

        const appCommand = this.appCommands.filter(cmd => cmd.name == scrimsCommand.name).first()
        if (appCommand) return false; // Command exists so we don't create it again

        // Comand is new so we create it
        await this.bot.application.commands.create(scrimsCommand)
            .catch(error => console.error(`Unable to create app command!`, scrimsCommand, error))

    }
    
    
    async updateCommandsPermissions() {

        const guilds = await this.bot.guilds.fetch()
        for (let guild of guilds.values()) 
            await this.updateGuildCommandsPermissions(guild)

    }

    async updateGuildCommandsPermissions(guild) {

        await Promise.all(this.appCommands.map(appCmd => this.updateCommandPermissions(guild, appCmd))).catch(console.error)

    }

    getCommandPermissionsGuildCommandPermissions(guild, perms) {

        return []; //Until we have adapted to stupid command permissions v2
        
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

            return false; //Until we have adapted to stupid command permissions v2
            
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