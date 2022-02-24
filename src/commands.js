
class ApplicationCommandPermissionsCache extends Array {

    /**
     * Combines the existing command permissions with the new `permissions` that should be added.
     * @param { ApplicationCommandPermissionData[] } permissions
     */
    add(permissions) {
        const newIds = permissions.map(perm => perm.id)
        this.filter(perm => newIds.includes(perm.id)).map(perm => this.splice(this.indexOf(perm), 1))
        this.push( ...permissions )
    }

}

class ScrimsBotCommandInstaller {

    constructor(client, commands) {
        this.client = client
        this.rawCommands = commands

        this.commands = {}
        this.addEventListeners()
    }

    /**
     * Starts listening for every event that could change whether or not a member (or multiple members) could lose or gain permissionLevels.
     * If there are permissionLevel changes, they are immediately applied to the effected ApplicationCommand permission managers.
     */
    addEventListeners() {

        this.client.on('roleUpdate', async (oldRole, newRole) => {
            if (!(newRole.guild.id in this.commands)) return false; // Guild has not had commands installed

            const changes = this.getCommandPermissionLevels().filter(level => this.hasPermission(oldRole, level) != this.hasPermission(newRole, level))
            if (changes.length < 1) return false; // This role update did not effect any command permissions
            await Promise.allSettled(
                changes.map(permissionLevel => this.addPermissions(
                        newRole.guild, permissionLevel, newRole.members.map(
                            member => this.hasPermission(member, permissionLevel) == this.hasPermission(newRole, permissionLevel)
                        ), this.hasPermission(newRole, permissionLevel)
                    )
                )
            )
        })

        this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
            if (!(newMember.guild.id in this.commands)) return false; // Guild has not had commands installed

            const changes = this.getCommandPermissionLevels().filter(level => this.hasPermission(oldMember, level) != this.hasPermission(newMember, level))
            if (changes.length < 1) return false;
            await Promise.allSettled(
                changes.map(permissionLevel => this.addPermissions(newMember.guild, permissionLevel, [newMember], this.hasPermission(newMember, permissionLevel)))
            )
        })

        this.client.on('guildMemberAdd', async (member) => {
            if (!(member.guild.id in this.commands)) return false; // Guild has not had commands installed
            await this.addMemberPermissions(member)
        })

    }

    async addMemberPermissions(member) {
        const perms = this.getCommandPermissionLevels().filter(level => this.hasPermission(member, level))
        if (perms.length < 1) return false;
        await Promise.all(
            perms.map(permissionLevel => this.addPermissions(member.guild, permissionLevel, [member], this.hasPermission(member, permissionLevel)))
        )
    }

    expandCommand(appCmd, rawCmd) {
        appCmd.permissionLevel = rawCmd.permissionLevel
        appCmd.permissions.cache = new ApplicationCommandPermissionsCache()
    }

    async install(guild) {
        await guild.commands.set([]) // Reset commands

        const commands = await Promise.all(
            this.rawCommands.map(
                rawCmd => guild.commands.create({ ...rawCmd, permissionLevel: undefined })
                    .then(appCmd => [appCmd, rawCmd])
            )
        )
        commands.forEach(([appCmd, rawCmd]) => this.expandCommand(appCmd, rawCmd))
        this.commands[guild.id] = commands.map(([appCmd, _]) => appCmd)
        this.installPermissions(guild).catch(console.error)
    }

    async installPermissions(guild) {
        const members = await guild.members.fetch()
            .then(members => members.filter(member => !member.user.bot))
            
        await Promise.all(members.map(member => this.addMemberPermissions(member)))
    }

    /**
     * Gets every permissionLevel value that was used while defining the commands in `/assets/commands.json`.
     */
    getCommandPermissionLevels() {
        return Object.values(this.commands)[0].map(cmd => cmd.permissionLevel);
    }

    /**
     * Checks if the member or role has the given permissionlevel **OR** higher.
     * 
     * @param  { GuildMember | Role } permissible
     * @param  { String } permissionLevel
     */
    hasPermission(permissible, permissionLevel) {
        if (permissionLevel == "ALL") return true;

        if (permissible?.permissions.has("ADMINISTRATOR")) return true;
        if (permissionLevel == "ADMIN") return false;

        if (this.client.staffRoles.some(roleId => permissible?.roles?.cache?.has(roleId))) return true;
        if (permissionLevel == "STAFF") return false;

        if (this.client.supportRoles.some(roleId => permissible?.roles?.cache?.has(roleId))) return true;
        if (permissionLevel == "SUPPORT") return false;

        return false;
    }

    /**
     * Allows or removes the permission of the given members to use any commands with the given `permissionLevel`.
     * The new permissions of a command are first added to the existing permissions (cache) and then set as the 
     * current command permissions.
     * 
     * @param { Guild } guild
     * @param { String } permissionLevel
     * @param { GuildMember[] } members
     * @param { Boolean } permission
     */
    async addPermissions(guild, permissionLevel, members, permission) {
        
        const commands = this.commands[guild.id].filter(cmd => cmd.permissionLevel == permissionLevel)
            
        commands.forEach(cmd => cmd.permissions.cache.add(members.map(member => ({ id: member.id, type: "USER", permission }))))

        await Promise.all(
            commands.map(cmd => cmd.permissions.set({ permissions: cmd.permissions.cache }))
        )

    }

}

module.exports = ScrimsBotCommandInstaller;