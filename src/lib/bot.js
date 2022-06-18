const { Client, Role } = require("discord.js");

const LimitedComponentContainer = require("./components/limited_components");
const ScrimsCommandInstaller = require("./tools/command_installer");
const ScrimsUserUpdater = require("./tools/user_updater");
const I18n = require("./tools/internationalization");

const HypixelClient = require("./middleware/hypixel");
const MojangClient = require("./middleware/mojang");
const DBClient = require("./postgresql/database");

const { interactionHandler, eventHandlers, commands } = require("./commands");
const ScrimsPermissionsClient = require("./permissions");
const ScrimsBotEventEmitter = require("./events");
const ScrimsGuild = require("./scrims/guild");

class ScrimsBot extends Client {

    constructor(intents, partials, presence, config) {
        
        super({ intents, partials, presence });

        this.token = process.env.DISCORD_TOKEN ?? config.discordToken;

        /** @type {DBClient} */
        this.database = new DBClient(config.dbLogin, this)

        /** @type {ScrimsPermissionsClient} */
        this.permissions = new ScrimsPermissionsClient(this.database)

        /** @type {ScrimsCommandInstaller} */
        this.commands = new ScrimsCommandInstaller(this);

        /** @type {ScrimsUserUpdater} */
        this.scrimsUsers = new ScrimsUserUpdater(this)

        /** @type {LimitedComponentContainer} */
        this.limitedComponents = new LimitedComponentContainer(this)

        /** @type {HypixelClient} */
        this.hypixel = new HypixelClient(config.hypixelToken);

        /** @type {MojangClient} */
        this.mojang = new MojangClient();

        /** @type {boolean} */
        this.blocked = false

        /** @type {string[]} */
        this.handles = []

        /** @type {I18n} */
        this.i18n = null

        /** @type {ScrimsBotEventEmitter} */
        this.scrimsEvents = new ScrimsBotEventEmitter(this)
        
        this.on('error', console.error)
        this.on('shardError', console.error)

        commands.forEach(([ cmdData, cmdPerms, cmdConfig ]) => this.commands.add(cmdData, interactionHandler, cmdPerms, cmdConfig))
        eventHandlers.forEach(event => this.commands.add(event, interactionHandler))

    }

    destroy() {

        this.database.destroy().catch(() => null)
        super.destroy()
        process.exit(0)
        
    }

    getConfig(guild_id, key) {
        return this.database.guildEntrys.cache.find({ guild_id, type: { name: key } })?.value ?? null;
    }

    async login() {

        await I18n.initializeLocales()
        this.i18n = I18n.getInstance()

        await super.login(this.token)

        const guilds = await this.guilds.fetch()

        await this.database.connect();
        this.emit("databaseConnected")
        console.log("Connected to database!")

        this.addEventListeners()

        console.log("Initializing commands...")
        await this.commands.initializeCommands()
        console.log("Commands initialized!")

        console.log("Initializing guilds...")
        await Promise.all(guilds.map(guild => this.updateScrimsGuild(null, guild)))
        console.log("Guilds initialized!")
        
        console.log("Initializing guild members...")
        await Promise.all(guilds.map(guild => this.scrimsUsers.initializeGuildMembers(guild)))
        console.log("Guild members initialized!")
        
        this.emit("startupComplete")
        console.log("Startup complete!")

    }

    /** @param {Role} role */
    hasRolePermissions(role) {

        const botMember = role.guild.me
        if (!(role.guild.ownerId === this.user.id || botMember.permissions.has("ADMINISTRATOR") || botMember.permissions.has("MANAGE_ROLES"))) return false;
        
        const largest = Math.max( ...botMember.roles.cache.map(role => role.position) )
        return (largest > role.position);

    }

    expandMember(member, scrimsUser) {

        if (member?.user?.scrimsUser) scrimsUser = member.user.scrimsUser
        if (scrimsUser) member.scrimsUser = scrimsUser
        if (!member.scrimsUser) member.scrimsUser = this.database.users.cache.find({ discord_id: member.id })
        if (member.user && member.scrimsUser) this.expandUser(member.user, member.scrimsUser)
        member.id_user = member?.scrimsUser?.id_user ?? null
        return member;
       
    }

    expandUser(user, scrimsUser) {

        if (scrimsUser) user.scrimsUser = scrimsUser
        if (!user.scrimsUser) user.scrimsUser = this.database.users.cache.find({ discord_id: user.id })
        user.id_user = user?.scrimsUser?.id_user ?? null
        return user;

    }

    async updateScrimsGuild(oldGuild, newGuild) {

        const existing = this.database.guilds.cache.resolve(newGuild.id)
        if (!existing) {

            return this.database.guilds.create(ScrimsGuild.fromDiscordGuild(newGuild))
                .catch(error => console.error(`Unable to create scrims guild because of ${error}!`));

        }

        if (existing?.name !== newGuild.name || existing?.icon !== newGuild.icon) {

            await this.database.guilds.update({ guild_id: newGuild.id }, { name: newGuild.name, icon: (newGuild?.icon ?? null) })
                .catch(error => console.error(`Unable to update scrims guild because of ${error}!`))

        }

    }

    addEventListeners() {

        this.on('guildCreate', guild => this.updateScrimsGuild(null, guild).catch(console.error))
        this.on('guildUpdate', (oldGuild, newGuild) => this.updateScrimsGuild(oldGuild, newGuild).catch(console.error))
        this.on('guildCreate', guild => this.commands.updateGuildCommandsPermissions(guild).catch(console.error))

    }

}


module.exports = ScrimsBot;
