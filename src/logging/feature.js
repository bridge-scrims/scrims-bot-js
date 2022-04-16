const { MessageEmbed, TextChannel } = require("discord.js");
const ScrimsPositionRole = require("../lib/scrims/position_role");
const ScrimsUserPosition = require("../lib/scrims/user_position");
const ScrimsUser = require("../lib/scrims/user");

class LoggingFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        bot.on('databaseConnected', () => this.addListeners())

    }

    get database() {

        return this.bot.database;

    }

    defaultURL() {

        return "https://cdn.discordapp.com/embed/avatars/1.png";

    }

    addListeners() {

        this.database.ipc.on('suggestions_error', message => this.onSuggestionsError(message.payload).catch(console.error))
        this.database.ipc.on('suggestions_success', message => this.onSuggestionsSuccess(message.payload).catch(console.error))
        
        this.database.ipc.on('audited_suggestion_remove', message => this.onSuggestionRemove(message.payload).catch(console.error))
        this.database.ipc.on('suggestion_create', message => this.onSuggestionCreate(message.payload).catch(console.error))

        this.database.ipc.on('positions_error', message => this.onPositionsError(message.payload).catch(console.error))
        this.database.ipc.on('audited_position_role_create', message => this.onPositionRoleCreate(message.payload).catch(console.error))
        this.database.ipc.on('audited_position_role_remove', message => this.onPositionRoleRemove(message.payload).catch(console.error))
    
        this.database.ipc.on('audited_user_position_remove', message => this.onUserPositionRemove(message.payload).catch(console.error))
        this.database.ipc.on('audited_user_position_expire_update', message => this.onUserPositionExpireUpdate(message.payload).catch(console.error))
        this.database.ipc.on('user_position_create', message => this.onUserPositionCreate(message.payload).catch(console.error))
        
        //this.database.ipc.on('position_discord_roles_received', message => this.onPositionRoleReceived(message.payload))
        //this.database.ipc.on('position_discord_roles_lost', message => this.onPositionRoleLost(message.payload))

    }

    async getFooterData(payload) {

        if (payload.guild_id) {

            const guild = await this.database.guilds.get({ discord_id: payload.guild_id }).then(results => results[0])
            if (guild) return { text: guild.name, iconURL: guild.iconURL() };

        }

        if (payload.suggestion?.id_guild) {

            const guild = await this.database.guilds.get({ id_guild: payload.suggestion.id_guild }).then(results => results[0])
            if (guild) return { text: guild.name, iconURL: guild.iconURL() };

        }

        if (payload.positionRole?.id_guild) {

            const guild = await this.database.guilds.get({ id_guild: payload.positionRole.id_guild }).then(results => results[0])
            if (guild) return { text: guild.name, iconURL: guild.iconURL() };

        }

        if (payload.guild_id === undefined) return null;

        return { text: "Unknown Guild", iconURL: this.defaultURL() };

    }

    async getAuthorData(payload, effect="") {

        if (payload.executor_id) {

            const user = await this.database.users.get({ discord_id: payload.executor_id }).then(results => results[0])
            if (user) return { name: user.tag || 'Unknown User', iconURL: user.avatarURL() ?? this.defaultURL() };

        }
        
        if (payload.executor_id === undefined) return null;

        return { name: `${effect}Unknown User${effect}`, iconURL: this.defaultURL() };

    }

    /**
     * @returns { Promise<TextChannel[]> }
     */
    async getChannels(configKey) {

        const configured = this.database.guildEntrys.cache.get({ type: { name: configKey } }).filter(config => config.guild && config.value)
        return Promise.all(configured.map(config => config.guild.channels.fetch(config.value).catch(() => null)))
            .then(channels => channels.filter(channel => channel && channel.type === "GUILD_TEXT"));

    }

    async sendLogMessages(payload, configKey, title, color) {

        if (!payload.msg) return;

        const footerData = await this.getFooterData(payload)
        const authorData = await this.getAuthorData(payload)

        const embed = new MessageEmbed()
            .setAuthor(authorData)
            .setTitle((!authorData) ? title : "")
            .setFooter(footerData)
            .setColor(color)
            .setDescription(payload.msg)
            .setTimestamp(Date.now())

        if (payload.suggestion && payload.suggestion?.creator && payload.suggestion?.created_at) {

            const creator = new ScrimsUser(this.database, payload.suggestion.creator)
            const suggestionInfo = `**Created by ${creator.getMention()} on <t:${payload.suggestion.created_at}:F>**`
            const suggestionText = payload.suggestion?.suggestion?.substring(0, 1024 - suggestionInfo.length - 25) ?? `Unknown Suggestion.`

            embed.addField(
                'Suggestion', 
                `${suggestionInfo}\n\`\`\`\n${suggestionText}`
                    + `${(payload.suggestion?.suggestion && (suggestionText.length !== payload.suggestion.suggestion.length)) ? "\n..." : ""}\`\`\``, 
                false
            )

            creator.close()

        }

        if (payload.error) {

            embed.addField(payload.error?.name || 'Error', `${payload.error?.message || 'Unknown error.'}`, false)

        }

        const channels = await this.getChannels(configKey)
        await Promise.allSettled(channels.map(channel => channel.send({ embeds: [embed] }).catch(console.error)))

    }

    async onSuggestionsError(payload) {

        return this.sendLogMessages(payload, "suggestions_log_channel", "Suggestions Error", '#cf1117');

    }

    async onSuggestionsSuccess(payload) {

        return this.sendLogMessages(payload, "suggestions_log_channel", "Suggestions Success", '#48cf23');
        
    }

    async onSuggestionRemove(payload) {

        const executorIsCreator = (payload?.executor_id === payload?.suggestion?.creator?.discord_id)
        const msg = (executorIsCreator ? `Removed their own suggestion.` : `Removed a suggestion.`)
        return this.sendLogMessages({ msg, ...payload }, "suggestions_log_channel", "Suggestions Remove", '#fc2344');

    }

    async onSuggestionCreate(suggestion) {

        const payload = { msg: "Created a suggestion.", executor_id: suggestion?.creator?.discord_id, suggestion }
        return this.sendLogMessages(payload, "suggestions_log_channel", "Suggestions Create", '#23cf6e');
        
    }

    async onPositionsError(payload) {

        return this.sendLogMessages(payload, "positions_log_channel", "Positions Error", '#cf1117');

    }

    async onPositionRoleCreate(payload) {

        if (!payload.positionRole) {

            const msg = `Created an unknown new positions role.`
            return this.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Position Role Created", '#23cf6e');

        }

        const positionRole = new ScrimsPositionRole(this.database, payload.positionRole)
        const role = positionRole.role ? `@${positionRole.role.name}` : positionRole.role_id
        const position = positionRole.position?.name ?? positionRole.id_position

        const msg = `Connected discord **${role}** to bridge scrims **${position}**.`
        return this.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Position Role Created", '#23cf6e');

    }

    async onPositionRoleRemove(payload) {

        payload = { guild_id: payload?.selector?.scrimsGuild?.discord_id, ...payload }

        const guild = payload.guild_id ? this.bot.guilds.resolve(payload.guild_id) : null
        const role = (guild && payload?.selector?.role_id) ? `@${guild.roles.resolve(payload?.selector?.role_id)?.name}` : payload?.selector?.role_id

        const position = (payload?.selector?.id_position) ? this.database.positions.cache.get({ id_position: payload.selector.id_position })[0]?.name : payload?.selector?.id_position

        const msg = `Unconnected discord **${role}** from ` + (position ? `bridge scrims **${position}**.` : `any bridge scrims positions.`)
        return this.sendLogMessages({ msg, ...payload }, "positions_log_channel", "Position Role Removed", '#fc2344');

    }

    async getExecutorMention(id_executor, executor_id) {

        if (!id_executor && !executor_id) return `**unknown-user**`;
        
        const user = await this.database.users.get((id_executor ? { id_user: id_executor } : { discord_id: executor_id })).then(results => results[0]).catch(() => null)
        if (!user) return `**unknown-user**`;

        return user.getMention("**");

    }

    async onUserPositionRemove(payload) {

        const userPosition = new ScrimsUserPosition(this.database, payload?.userPosition || {})

        const msg = `Lost bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}**.`
            + ` Because of ${await this.getExecutorMention(null, payload.executor_id)} removing it.`

        return this.sendLogMessages({ msg, ...payload, executor_id: userPosition?.user?.discord_id ?? null }, "positions_log_channel", "Position Taken", '#fc2360');

    }

    async onUserPositionCreate(userPositionData) {

        const userPosition = new ScrimsUserPosition(this.database, userPositionData)

        const msg = `Got bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}** `
            + `${userPosition.getDuration()} from ${await this.getExecutorMention(userPosition.id_executor)}.`

        return this.sendLogMessages({ msg, executor_id: userPosition?.user?.discord_id ?? null }, "positions_log_channel", "Position Given", '#23cf93');

    }

    async onUserPositionExpireUpdate(payload) {

        const userPosition = new ScrimsUserPosition(this.database, { ...payload.userPosition, expires_at: payload.expires_at })

        const msg = `Got their bridge scrims **${userPosition?.position?.name || userPosition?.id_position || 'unknown-position'}** `
            + `updated by ${await this.getExecutorMention(null, payload.executor_id)} it will now last ${userPosition.getDuration()}.`
        
        return this.sendLogMessages({ msg, executor_id: userPosition?.user?.discord_id ?? null }, "positions_log_channel", "Position Updated", '#23cf93');

    }


}

module.exports = LoggingFeature;