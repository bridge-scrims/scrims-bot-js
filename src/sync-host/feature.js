const ScrimsPositionUpdater = require("./updater");
const { interactionHandler, commands, eventListeners } = require("./commands");
const ScrimsUserPosition = require("../lib/scrims/user_position");

class ScrimsSyncHostFeature {

    constructor(bot, config) {

        /** @type {import("../bot")} */
        this.bot = bot

        /** @type {string} */
        this.hostGuildId = config.hostGuildId
        
        commands.forEach(([ cmdData, cmdPerms, cmdConfig ]) => this.bot.commands.add(cmdData, interactionHandler, cmdPerms, cmdConfig))
        eventListeners.forEach(eventName => this.bot.commands.add(eventName, interactionHandler))
        
        this.positionUpdater = new ScrimsPositionUpdater(this)

        bot.on('startupComplete', () => this.startUp().catch(console.error))

    }

    get permissions() {

        return this.bot.permissions;

    }

    async startUp() {

        // at this point the updater has started listening for events

        this.bot.on('guildCreate', guild => this.onGuildJoin(guild).catch(console.error))
        
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
            await this.initializeMembers(guild, members).catch(console.error)
            console.log("Host guild members initialized!")

        }

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

    getMemberMissingPositions(member, scrimsUser, userPositions, bans) {

        const currentPositions = scrimsUser.getPositions(userPositions)

        const allPositionRoles = member ? this.permissions.getGuildPositionRoles(member.guild.id) : []
        const allowedPositionRoles = allPositionRoles.filter(pRole => this.permissions.hasRequiredPositionRoles(member, pRole.id_position, true))

        const bannedPosition = this.bot.database.positions.cache.find({ name: "banned" })
        if (bans && bannedPosition && scrimsUser.discord_id && bans.has(scrimsUser.discord_id)) allowedPositionRoles.push(bannedPosition)
        
        const missingPositionRoles = allowedPositionRoles.filter(pRole => !currentPositions.hasPosition(pRole.id_position))
        return Array.from(new Set(missingPositionRoles.map(pRole => pRole.id_position)));

    }

    getMemberUnallowedPositions(member, scrimsUser, userPositions, bans) {

        const currentPositions = scrimsUser.getPositions(userPositions).getUserPositions()
        const unallowedPositions = member ? currentPositions.filter(userPos => !this.permissions.hasRequiredPositionRoles(member, userPos.position, true)) : currentPositions.filter(userPos => (!userPos.position?.sticky) && (userPos.position?.name !== "banned"))

        const bannedPosition = this.bot.database.positions.cache.find({ name: "banned" })
        if (bans && bannedPosition && scrimsUser.discord_id && !bans.has(scrimsUser.discord_id) && currentPositions.find(v => v.id_position === bannedPosition.id_position)) 
            unallowedPositions.push(bannedPosition)

        return Array.from(new Set(unallowedPositions.map(userPos => userPos.id_position)));

    }

    async createScrimsPosition(selector, executor) {

        const userPosition = new ScrimsUserPosition(this.bot.database, selector)
            .setExecutor({ discord_id: (executor?.id || this.bot.user.id) })
            .setGivenPoint().setExpirationPoint(null)

        await this.bot.database.userPositions.create(userPosition) 
            .catch(error => console.error(`Unable to create scrims user position because of ${error}!`, userPosition))

    }

    async removeUnstickyPositions(scrimsUser, userPositions) {

        const nonStickyPositions = userPositions.getUserPositions().filter(userPos => (!userPos.position?.sticky))
        await Promise.all(
            nonStickyPositions.map(userPos => this.bot.database.userPositions.remove(userPos)
                .catch(error => console.error(`Unable to remove non sticky positions of user!`, error, nonStickyPositions))
            )
        )
        
    }

    async scrimsMemberRemove(scrimsUser, userPositions) {

        // Remove all non sticky positions
        await this.removeUnstickyPositions(scrimsUser, userPositions)

    }

    async initializeMembers(guild, members) {

        members = members.filter(m => m.scrimsUser)
        const userPositions = await this.bot.database.userPositions.getArrayMap({}, ['id_user'], false)
        for (const member of members.values()) await this.initializeMember(member, userPositions)
        
    }

    async getMembersPositionsDifference(guild) {

        const userPositions = await this.bot.database.userPositions.getArrayMap({}, ["id_user"], false)
        const scrimsUsers = this.bot.database.users.cache.values()
        const bans = await this.bot.completelyFetch(guild.bans, 1000)

        return scrimsUsers.map(user => [
            this.getMemberMissingPositions(user.getMember(guild), user, userPositions, bans), 
            this.getMemberUnallowedPositions(user.getMember(guild), user, userPositions, bans)
        ]);

    }

    async transferPositions(guild, id_executor) {

        const userPositions = await this.bot.database.userPositions.getArrayMap({}, ["id_user"], false)
        const scrimsUsers = this.bot.database.users.cache.values()
        const bans = await this.bot.completelyFetch(guild.bans, 1000)

        return Promise.all(scrimsUsers.map(user => this.transferPositionsForMember(id_executor, user, this.getMemberMissingPositions(user.getMember(guild), user, userPositions, bans), this.getMemberUnallowedPositions(user.getMember(guild), user, userPositions, bans))))
            .then(results => results.reduce(([rmv, create], [removeResults, createResults]) => [ [...rmv, ...removeResults], [...create, ...createResults] ], [[], []]))

    }

    async transferPositionsForMember(id_executor, scrimsUser, create, remove) {

        const removeResults = await Promise.all(
            remove.map(id_position => this.bot.database.userPositions.remove({ id_user: scrimsUser.id_user, id_position })
                .then(removed => removed.length > 0 ? this.bot.database.ipc.notify("audited_user_position_remove", { id_executor, userPosition: removed[0] }) : null).then(() => true)
                .catch(error => console.error(`Unable to remove user position because of ${error}!`, scrimsUser, id_position))
            )
        )

        const createResults = await Promise.all(
            create.map(id_position => ({ id_user: scrimsUser.id_user, id_position, given_at: Math.floor(Date.now()/1000), id_executor }))
                .map(userPos => this.bot.database.userPositions.create( userPos ).then(() => true)
                    .catch(error => console.error(`Unable to create user position because of ${error}!`, userPos))
                )
        )

        return [removeResults, createResults];

    }

    async initializeMember(member, userPositions) {

        const staff = this.bot.database.positions.cache.find({ name: "staff" })
        if (!staff) return false;
        
        await Promise.all(
            staff.getPositionLevelPositions()
                .map(position => (async () => {
                    if (!member.scrimsUser.getPositions(userPositions).hasPosition(position)) await this.givePosition(member, position)
                })())
        ) 

    }

    async givePosition(member, positionName) {

        const authorized = this.permissions.hasRequiredPositionRoles(member, positionName, false)
        if (authorized) {

            await this.createScrimsPosition({ user: { discord_id: member.id }, position: { name: positionName } }, null)

        }

    }


}

module.exports = ScrimsSyncHostFeature;