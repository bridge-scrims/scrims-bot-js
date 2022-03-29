const { ApplicationCommand } = require("discord.js")

class ScrimsCommandInstaller {

    constructor(bot) {

        this.bot = bot

        this.cmdData = []

        this.appCommands = []

    }

    async initializeCommands() {

        this.appCommands = await this.bot.application.commands.fetch()
        const guilds = await this.bot.guilds.fetch()
        
        this.cmdData.forEach(([ cmd, perms ]) => this.setScrimsCommandDefaultPermission(cmd, perms, guilds))
        await this.update()

    }

    setScrimsCommandDefaultPermission(scrimsCommand, scrimsPermissions, guilds) {

        const guildPermissions = guilds.map(guild => this.getCommandPermissionsGuildCommandPermissions(guild, scrimsPermissions))
        const defaultPermission = guildPermissions.some(perms => perms.length > 10) && guildPermissions.some(perms => perms.length > 0)
        scrimsCommand.setDefaultPermission(defaultPermission)

    }

    async update() {

        await this.updateCommands()
        await this.updateCommandsPermissions()

    }

    add(commandData, commandPermissionData={}) {

        this.cmdData.push([ commandData, commandPermissionData ])

    }

    getScrimsCommand(name) {

        const scrimsCommand = this.cmdData.filter(([cmd, _]) => cmd.name == name)[0];
        if (scrimsCommand) return scrimsCommand[0];
        return null;

    }

    getScrimsCommandPermissions(name) {

        const scrimsCommand = this.cmdData.filter(([cmd, _]) => cmd.name == name)[0];
        if (scrimsCommand) return scrimsCommand[1];
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
        await Promise.all(guilds.map(guild => this.updateGuildCommandsPermissions(guild)))

    }

    async updateGuildCommandsPermissions(guild) {

        await Promise.all(this.appCommands.map(appCmd => this.updateCommandPermissions(guild, appCmd))).catch(console.error)

    }

    getCommandPermissionsGuildCommandPermissions(guild, perms) {

        const positions = this.bot.permissions.getCommandAllowedPositions(perms)
        const roles = positions.map(position => this.bot.permissions.getPositionRequiredRoles(guild.id, position)).flat()
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
        if (permissions.length === 0 || permissions.length > 10) {

            await appCmd.permissions.set({ command: appCmd.id, guild: guild.id, permissions: [] })
                .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id} to none!`, error))
            
            return false; 

        }

        // Set command permissions
        await appCmd.permissions.set({ command: appCmd.id, guild: guild.id, permissions })
            .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id}!`, permissions, error))

    }



}

module.exports = ScrimsCommandInstaller;