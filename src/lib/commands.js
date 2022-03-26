
class ScrimsCommandInstaller {

    constructor(bot) {

        this.bot = bot

        this.cmdData = []

        this.appCommands = []

    }

    async initializeCommands() {

        this.appCommands = await this.bot.application.commands.fetch()
        
        await this.update()

    }

    async update() {

        await this.updateCommands()
        await this.updateCommandsPermissions()

    }

    getScrimsCommand(name) {

        return this.cmdData.filter(cmd => cmd.name == name)[0] ?? null;

    }

    getAppCommandData() {

        return this.cmdData.map(
            rawCmd => ({ ...rawCmd, permissionLevel: undefined, allowedPositions: undefined, requiredPositions: undefined })
        );

    }

    async updateCommands() {

        const newCmdData = require("../assets/commands.json");
        const getNewCommandData = (name) => newCmdData.filter(cmd => cmd.name == name)[0] ?? null;
   
        // UPDATING
        await Promise.all( this.appCommands.map(appCmd => this.updateAppCommand(appCmd, getNewCommandData(appCmd.name))) )

        // ADDING NEW
        await Promise.all( newCmdData.map(cmdData => this.addAppComand(cmdData)) )

        // RELOADING
        this.cmdData = newCmdData
        this.appCommands = await this.bot.application.commands.fetch()
        
    }

    async updateAppCommand(appCmd, newScrimsCommand) {

        const scrimsCommand = this.getScrimsCommand(appCmd.name)

        // Command no longer exists so delete it
        if (newScrimsCommand === null) await this.bot.application.commands.delete(appCmd.id)
            .catch(error => console.error(`Unable to delete app command with id ${appCmd.id}!`, appCmd, error))
        
        // Command exists
        if (newScrimsCommand && scrimsCommand) {
            // Command version changed so update it
            if (scrimsCommand.version != newScrimsCommand.version)
                await this.bot.application.commands.edit(appCmd.id, newScrimsCommand)
                    .catch(error => console.error(`Unable to edit app command with id ${appCmd.id}!`, newScrimsCommand, error))
        }
            
    }

    async addAppComand(newScrimsCommand) {

        const scrimsCommand = this.getScrimsCommand(newScrimsCommand.name)
        if (scrimsCommand) return false; // Command exists so we don't create it again

        // Comand is new so we create it
        await this.bot.application.commands.create(newScrimsCommand)
            .catch(error => console.error(`Unable to create app command!`, newScrimsCommand, error))

    }
    
    
    async updateCommandsPermissions() {

        const guilds = await this.bot.guilds.fetch()
        await Promise.all(guilds.map(guild => this.updateGuildCommandsPermissions(guild)))

    }

    async updateGuildCommandsPermissions(guild) {

        await Promise.all(this.appCommands.map(appCmd => this.updateCommandPermissions(guild, appCmd))).catch(console.error)

    }

    async updateCommandPermissions(guild, appCmd) {

        const scrimsCommand = this.getScrimsCommand(appCmd.name)

        const positions = this.bot.permissions.getCommandAllowedPositions(scrimsCommand)
        const roles = positions.map(position => this.bot.permissions.getPositionRequiredRoles(guild.id, position)).flat()
        const permissions = roles.map(roleId => ({ id: roleId, permission: true, type: 'ROLE', }))
        
        const existingPerms = await appCmd.permissions.fetch({ command: appCmd.id, guild: guild.id }).catch(() => null)

        // Permissions have not changed so just leave it
        if (!existingPerms && permissions.length === 0) return true;
        if ((JSON.stringify(existingPerms) == JSON.stringify(permissions))) return true;
        
        // Can not block the command client side, since discord only allows up to 10 permissions
        if (roles.length === 0 || roles.length > 10) {

            await appCmd.setDefaultPermission(true)
                .catch(error => console.error(`Unable to enable default permission for command ${appCmd.name}/${appCmd.id}!`, error))
            
            await appCmd.permissions.set({ command: appCmd.id, guild: guild.id, permissions: [] })
                .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id} to none!`, error))
            
            return false; 

        }

        // Set command permissions
        await appCmd.permissions.set({ command: appCmd.id, guild: guild.id, permissions })
            .then(() => appCmd.setDefaultPermission(false))
            .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id}!`, permissions, error))

    }



}

module.exports = ScrimsCommandInstaller;