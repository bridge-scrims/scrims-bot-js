const { Constants, User, GuildMember, Guild, MessageEmbed } = require("discord.js");
const ScrimsUserPermissionsManager = require("./user_permissions");
const ScrimsUserPosition = require("./user_position");
const TableRow = require("../postgresql/row");

class ScrimsUser extends TableRow {

    static uniqueKeys = ['id_user']
    static columns = [
        'id_user', 'joined_at', 'discord_id', 'discord_username', 
        'discord_discriminator', 'discord_accent_color', 'discord_avatar', 
        'mc_uuid', 'mc_name', 'mc_verified', 'country', 'timezone'
    ]

    static sortByPositions(userPositions) {

        return (a, b) => ((userPositions[b.id_user]?.length ?? -1) - (userPositions[a.id_user]?.length ?? -1));

    }

    /** @param {GuildMember} member */
    static fromGuildMember(member) {
        
        return new ScrimsUser(member.client.database)
            .setJoinPoint(Math.floor(member.joinedTimestamp/1000))
            .setDiscord(member.user)

    }

    constructor(client, userData) {

        super(client, userData)

        /** @type {string} */
        this.id_user
        if (!this.id_user) this.setId()

        /** @type {number} */
        this.joined_at

        /** @type {string|null} */
        this.discord_id

        /** @type {string|null} */
        this.discord_username

        /** @type {string|null} */
        this.discord_discriminator

        /** @type {number|null} */
        this.discord_accent_color

        /** @type {string|null} */
        this.discord_avatar

        /** @type {string|null} */
        this.mc_uuid

        /** @type {string|null} */
        this.mc_name

        /** @type {boolean} */
        this.mc_verified

        /** @type {string|null} */
        this.country

        /** @type {string|null} */
        this.timezone

        /** @type {ScrimsUserPermissionsManager} */
        this.permissions = new ScrimsUserPermissionsManager(this)

    }

    get discordUser() {

        if (!this.discord_id || !this.bot) return null;
        return this.bot.users.resolve(this.discord_id);

    }

    get tag() {

        if (!this.discord_username || !this.discord_discriminator) return null;
        return `${this.discord_username}#${`${this.discord_discriminator}`.padStart(4, '0')}`;

    }

    toString() {

        return this.getMention("**");

    }

    /**
     * @param {string} [id_user] if falsley will use a random uuid
     */
    setId(id_user) {

        this.id_user = id_user ?? this.client.generateUUID()
        return this;

    }

    /**
     * @param {number} joined_at
     */
    setJoinPoint(joined_at) {
        
        this.joined_at = joined_at
        return this;

    }

    /**
     * @param {string|number} discord_discriminator 
     */
    setDiscordDiscriminator(discord_discriminator) {

        if (typeof discord_discriminator === 'string') discord_discriminator = parseInt(discord_discriminator)
        this.discord_discriminator = discord_discriminator
        return this;

    }

    /**
     * @param {User} user
     */
    setDiscord(user) {
        
        this.discord_id = user.id
        this.discord_username = user.username
        this.setDiscordDiscriminator(user.discriminator)
        this.discord_accent_color = user.accentColor ?? null
        this.discord_avatar = user.avatar ?? null

        return this;
        
    }

    /**
     * @param {string} mc_uuid
     */
    setMCUUID(mc_uuid) {

        this.mc_uuid = mc_uuid
        return this;

    }

    /**
     * @param {string} mc_name
     */
    setMCName(mc_name) {

        this.mc_name = mc_name
        return this;

    }

    /**
     * @param {string} mc_verified
     */
    setMCVerified(mc_verified) {

        this.mc_verified = mc_verified
        return this;

    }

    /**
     * @param {string} country
     */
    setCountry(country) {

        this.country = country
        return this;

    }

    /**
     * @param {string} timezone
     */
    setTimezone(timezone) {

        this.timezone = timezone
        return this;

    }

    getMention(effect="") {

        if (this.discordUser) return `${this.discordUser}`;
        if (this.tag) return `${effect}@${this.tag}${effect}`;
        return `${effect}@unknown-user${effect}`;

    }

    getCurrentTime() {

        if (!this.timezone) return null;
        return moment.tz(moment(), this.timezone);        

    }

    /** @param {Guild} guild */
    getMember(guild) {

        if (!this.discord_id || !guild) return null;
        return guild.members.cache.get(this.discord_id) ?? null;

    }

    getUTCOffset() {

        if (!this.timezone) return null;
        const seconds = moment.parseZone(this.timezone)?.utcOffset()
        if (!seconds) return null;

        const hours = `${Math.floor(Math.abs(seconds)/60)}`.padStart(2, '0')
        const minutes = `${Math.round(Math.abs(seconds)%60)}`.padEnd(2, '0')
        return `${(seconds < 0) ? '-' : '+'}${hours}:${minutes}`

    }

    async fetchPositions(show_expired=false) {

        return this.permissions.fetchPositions(show_expired);

    }

    getUserPositions(userPositions) {

        return this.permissions.getUserPositions(userPositions);

    }

    /**
     * @returns {string} The user's avatar URL, default avatar URL or null
     */
    avatarURL() {

        const cdn = Constants.Endpoints.CDN("https://cdn.discordapp.com")
        
        if (!this.discord_discriminator) return null;
        const defaultAvatar = cdn.DefaultAvatar(this.discord_discriminator % 5)

        if (!this.discord_id || !this.discord_avatar) return defaultAvatar;
        const avatar = cdn.Avatar(this.discord_id, this.discord_avatar, undefined, undefined, true)
        
        return avatar ?? defaultAvatar;

    }

    toEmbed(userPositions, guild) {

        const member = (guild ? this.getMember(guild) : null)
        const title = this.tag + ((member && member.displayName.toLowerCase() !== this.discord_username.toLowerCase()) ? ` (${member.displayName})` : '') 
        
        const embed = new MessageEmbed()
            .setColor(this.discord_accent_color ?? "#A14F50")
            .setThumbnail(this.avatarURL())
            .setTitle(title)

        embed.addField("Scrims UUID", this.id_user, false)
        embed.addField("Discord ID", this.discord_id, true)
        embed.addField("Registered At", `<t:${this.joined_at}:d>`, true)

        if (this.mc_uuid && this.mc_name) embed.addField("Minecraft Account", `${this.mc_name} (${this.mc_uuid})`, false)
        if (this.country) embed.addField("Country", this.country, true)
        if (this.getUTCOffset()) embed.addField("Timezone", `${this.timezone} (${this.getUTCOffset()})`, true)
        if (userPositions) {

            const positions = Object.values(this.permissions.getUserPositions(userPositions))
            if (positions?.length > 0) embed.addField(
                "Scrims Positions", positions.filter(userPos => userPos.position)
                    .sort(ScrimsUserPosition.sortByLevel)
                    .map(userPos => {
                        const text = `\`•\` **${userPos.position.name}** (${userPos.position.id})`
                        if (guild) {
                            const connectedRoles = userPos.position.getConnectedRoles(guild.id)
                            if (connectedRoles?.length > 0) return `${text} **⇨** ${connectedRoles.join(' ')}`;
                        }
                        return text;
                    }).join('\n')
            )

        }

        return embed;

    }

}

module.exports = ScrimsUser;