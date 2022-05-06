const ScrimsPositionUpdater = require("./updater");

const { interactionHandler, commands, eventListeners } = require("./commands");


class ScrimsSyncHostFeature {

    constructor(bot, config) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        /**
         * @type { String }
         */
        this.hostGuildId = config.hostGuildId
        
        commands.forEach(([ cmdData, cmdPerms ]) => this.bot.commands.add(cmdData, cmdPerms))
        
        this.positionUpdater = new ScrimsPositionUpdater(this)

        bot.on('ready', () => this.addEventHandlers())
        bot.on('startupComplete', () => this.startUp())

    }

    get permissions() {

        return this.bot.permissions;

    }

    async startUp() {

        // at this point the updater has started listening for events

        this.bot.on('guildCreate', guild => this.onGuildJoin(guild))
        
        const guild = await this.fetchHostGuild()
        if (guild) await this.intitializeGuild(guild)

    }

    async onGuildJoin(guild) {

        if (guild.id === this.hostGuildId) await this.intitializeGuild(guild)

    }

    async intitializeGuild(guild) {

        const members = await guild.members.fetch()
            .catch(error => console.error(`Unable to fetch members of host discord server because of ${error}!`, guild.id))

        if (members) {

            console.log("Initializing host guild members...")
            await this.initializeMembers(guild, members)
            console.log("Host guild members initialized!")

        }

    }

    addEventHandlers() {

        commands.forEach(([ cmdData, _ ]) => this.bot.addEventHandler(cmdData.name, interactionHandler))
        eventListeners.forEach(eventName => this.bot.addEventHandler(eventName, interactionHandler))
        
    }

    async fetchHostGuild() {

        return this.bot.guilds.fetch(this.hostGuildId)
            .catch(error => console.error(`Unable to fetch main discord server because of ${error}!`))

    }

    async fetchHostGuildMembers() {

        const guild = await this.fetchHostGuild()
        if (guild) {

            return guild.members.fetch()
                .catch(error => console.error(`Unable to fetch members of main discord server!`, error))

        }

        return null;

    }

    getMemberMissingPositions(member, userPositions=[]) {

        const allPositionRoles = this.permissions.getGuildPositionRoles(member.guild.id)
        const allowedPositionRoles = allPositionRoles.filter(pRole => this.permissions.hasRequiredPositionRoles(member, pRole.id_position))
        const missingPositionRoles = allowedPositionRoles.filter(pRoleA => userPositions.filter(pRoleB => pRoleA.id_position == pRoleB.id_position).length === 0)
        
        return missingPositionRoles;

    }

    getMemberUnallowedPositions(member, userPositions=[]) {

        return userPositions.filter(userPos => !this.memberIsAllowedPosition(member, userPos.position))

    }

    memberIsAllowedPosition(member, position) {

        const requiredRoles = this.permissions.getPositionRequiredRoles(member.guild.id, position.id_position)
        return (requiredRoles.every(roleId => member.roles.cache.has(roleId)));

    }

    async addUserMemberPosition(memberId) {

        const selector = { position: { name: "bridge_scrims_member" }, user: { discord_id: memberId } }

        const existing = await this.bot.database.userPositions.get(selector).catch(console.error)
        if (existing && existing.length > 0) return true;

        return this.createScrimsPosition(selector, null)

    }

    async createScrimsPosition(selector, executor) {

        const userPositionData = {
            given_at: Math.round(Date.now()/1000), 
            executor: { discord_id: (executor?.id || this.bot.user.id) },
            ...selector
        }

        await this.bot.database.userPositions.create( userPositionData ) 
            .catch(error => console.error(`Unable to create scrims user position because of ${error}!`, userPositionData))

    }

    async addScrimsUser(member) {

        await this.bot.scrimsUsers.createScrimsUser(member)
        await this.addUserMemberPosition(member.id)

    }

    async removeUnstickyPositions(id_user, userPositions=[]) {

        const nonStickyPositions = userPositions.filter(userPos => userPos.position).filter(userPos => !userPos.position.sticky)
        await Promise.all(
            nonStickyPositions.map(userPos => this.bot.database.userPositions.remove({ id_user, id_position: userPos.id_position })
                .catch(error => console.error(`Unable to remove non sticky positions of user with discord id ${memberId}!`, error))
            )
        )
        
    }

    async scrimsMemberRemove(id_user, userPositions) {

        // Remove all non sticky positions
        await this.removeUnstickyPositions(id_user, userPositions)

    }

    async initializeMembers(guild, members) {

        const userPositions = await this.bot.database.userPositions.getArrayMap({ }, ['user', 'discord_id'])

        await Promise.all(members.map(member => this.initializeMember(member, userPositions[member.id])))

        const ghostUsers = this.bot.database.users.cache.values()
            .filter(scrimsUser => userPositions[scrimsUser.discord_id] && userPositions[scrimsUser.discord_id].filter(userPos => userPos?.position?.name === "bridge_scrims_member").length > 0)
            .filter(scrimsUser => !guild.members.cache.has(scrimsUser.discord_id))

        await Promise.all(ghostUsers.map(ghost => this.scrimsMemberRemove(ghost.id_user, userPositions[ghost.discord_id])))

    }

    async getMembersPositionsDifference(guild) {

        const userPositions = this.bot.database.userPositions.cache.getArrayMap("user", "discord_id")
        const members = await guild.members.fetch()

        return members.map(member => [ 
            this.getMemberMissingPositions(member, userPositions[member.id]), 
            this.getMemberUnallowedPositions(member, userPositions[member.id]) 
        ]);

    }

    async transferPositions(guild, id_executor) {

        const userPositions = await this.bot.database.userPositions.getArrayMap({}, ["user", "discord_id"])
        const members = await guild.members.fetch()

        return Promise.all(members.map(member => this.transferPositionsForMember(id_executor, member, userPositions[member.id])))
            .then(results => results.reduce(([rmv, create], [removeResults, createResults]) => [ [...rmv, ...removeResults], [...create, ...createResults] ], [[], []]))

    }

    async transferPositionsForMember(id_executor, member, userPositions) {

        const remove = this.getMemberUnallowedPositions(member, userPositions)
        const removeResults = await Promise.all(
            remove.map(userPos => this.bot.database.userPositions.remove({ id_user: userPos.id_user, id_position: userPos.id_position })
                .then(() => this.bot.database.ipc.notify("audited_user_position_remove", { id_executor, userPosition: userPos })).then(() => true)
                .catch(error => console.error(`Unable to remove user position because of ${error}!`, userPos))
            )
        )

        const create = this.getMemberMissingPositions(member, userPositions)
            .map(posRole => ({ user: { discord_id: member.id }, id_position: posRole.id_position, given_at: Math.round(Date.now()/1000), id_executor }))
        
        const createResults = await Promise.all(
            create.map(userPos => this.bot.database.userPositions.create( userPos ).then(() => true)
                .catch(error => console.error(`Unable to create user position because of ${error}!`, userPos))
            )
        )

        return [removeResults, createResults];

    }

    async initializeMember(member, userPositions) {

        if (!userPositions || userPositions.filter(userPos => userPos?.position?.name === "bridge_scrims_member").length === 0)
            await this.createScrimsPosition({ position: { name: "bridge_scrims_member" }, user: { discord_id: member.id } }, null)

        const positions = this.permissions.getPermissionLevelPositions("staff")
            .filter(position => !userPositions || userPositions.filter(userPos => userPos?.position?.name === position).length === 0) 

        await Promise.all(positions.map(position => this.givePosition(member, position)))

    }

    async givePosition(member, positionName) {

        const authorized = this.permissions.hasRequiredPositionRoles(member, positionName, false)
        if (authorized) {

            await this.createScrimsPosition({ user: { discord_id: member.id }, position: { name: positionName } }, null)

        }

    }


}

module.exports = ScrimsSyncHostFeature;