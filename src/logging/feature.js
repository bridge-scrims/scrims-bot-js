const { MessageEmbed, TextChannel } = require("discord.js");
const PositionLoggingFeature = require("./positions");
const ScrimsUser = require("../lib/scrims/user");
const ScrimsTicket = require("../lib/scrims/ticket");

class LoggingFeature {

    constructor(bot) {

        /**
         * @type { import("../bot") }
         */
        this.bot = bot

        this.positions = new PositionLoggingFeature(this.bot)

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

        this.database.ipc.on('ticket_error', message => this.onTicketError(message.payload).catch(console.error))
        this.database.ipc.on('ticket_success', message => this.onTicketSuccess(message.payload).catch(console.error))
        this.database.ipc.on('ticket_create', message => this.onTicketCreate(message.payload).catch(console.error))
        this.database.ipc.on('ticket_closed', message => this.onTicketClose(message.payload).catch(console.error))

    }

    async getUser(id_user, discord_id) {

        if (!id_user && !discord_id) return null;
        return this.database.users.get((id_user ? { id_user } : { discord_id })).then(results => results[0]).catch(() => null)

    }

    async getFooterData(payload) {

        if (payload.guild_id) {

            const guild = await this.database.guilds.get({ discord_id: payload.guild_id }).then(results => results[0])
            if (guild) return { text: guild.name, iconURL: guild.iconURL() };

        }

        if (payload.id_guild) {

            const guild = await this.database.guilds.get({ id_guild: payload.id_guild }).then(results => results[0])
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
            if (user) return { name: user.tag || 'Unknown User', iconURL: user.avatarURL() ?? this.defaultURL(), mention: user.discordUser };

        }

        if (payload.id_executor) {

            const user = await this.database.users.get({ id_user: payload.id_executor }).then(results => results[0])
            if (user) return { name: user.tag || 'Unknown User', iconURL: user.avatarURL() ?? this.defaultURL(), mention: user.discordUser };

        }
        
        if (payload.executor_id === undefined && payload.id_executor === undefined) return null;

        return { name: `${effect}Unknown User${effect}`, iconURL: this.defaultURL() };

    }

    /**
     * @returns { Promise<TextChannel[]> }
     */
    async getChannels(configKey, guilds) {

<<<<<<< HEAD
        const configured = this.database.guildEntrys.cache.find({ type: { name: configKey } })
            .filter(config => config.discordGuild && config.value && (!guilds || guilds.includes(config.guild_id)))
=======
        const configured = this.database.guildEntrys.cache.get({ type: { name: configKey } })
            .filter(config => config.discordGuild && config.value && (!guilds || guilds.includes(config.discordGuild.id)))
>>>>>>> main
        
        return Promise.all(configured.map(config => config.discordGuild.channels.fetch(config.value).catch(() => null)))
            .then(channels => channels.filter(channel => channel && channel.type === "GUILD_TEXT"));

    }

    async sendLogMessages(payload, configKey, title, color, guilds) {

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

        }

        if (payload.error) {

            embed.addField(payload.error?.name || 'Error', `${payload.error?.message || 'Unknown error.'}`, false)

        }

        const mentions = [ authorData?.mention, ...(payload?.mentions ?? []) ].filter(v => v).map(v => `${v}`)
        const msgPayload = { content: (mentions.length > 0) ? mentions.join(' ') : null, embeds: [embed], allowedMentions: { parse: [] } }

        const channels = await this.getChannels(configKey, guilds)
        await Promise.allSettled(channels.map(channel => channel.send(msgPayload).catch(console.error)))

    }

    async onSuggestionsError(payload) {

        return this.sendLogMessages(payload, "suggestions_log_channel", "Suggestions Error", '#cf1117', [payload.guild_id]);

    }

    async onSuggestionsSuccess(payload) {

        return this.sendLogMessages(payload, "suggestions_log_channel", "Suggestions Success", '#00FF44', [payload.guild_id]);
        
    }

    async onSuggestionRemove(payload) {

        const executorIsCreator = (payload?.executor_id === payload?.suggestion?.creator?.discord_id)
        const msg = (executorIsCreator ? `Removed their own suggestion.` : `Removed a suggestion.`)
        return this.sendLogMessages({ msg, ...payload }, "suggestions_log_channel", "Suggestions Remove", '#fc2344', [payload?.suggestion?.guild?.discord_id]);

    }

    async onSuggestionCreate(suggestion) {

        const payload = { msg: "Created a suggestion.", executor_id: suggestion?.creator?.discord_id, suggestion }
        return this.sendLogMessages(payload, "suggestions_log_channel", "Suggestions Create", '#23cf6e', [suggestion?.guild?.discord_id]);
        
    }

    async onTicketError(payload) {

        return this.sendLogMessages(payload, "tickets_log_channel", "Ticket Error", '#CF1117', [payload.guild_id]);

    }

    async onTicketSuccess(payload) {

        return this.sendLogMessages(payload, "tickets_log_channel", "Ticket Success", '#00FF44', [payload.guild_id]);
        
    }

    async onTicketCreate(ticketData) {

        const ticket = new ScrimsTicket(this.database, ticketData)
        const payload = { 
            msg: `Created a ${ticket.type.name} ticket at ${ticket.channel ?? `**${ticket.channel_id}**`} with an id of \`${ticket.id_ticket}\`.`,
            guild_id: ticket.guild_id, id_executor: ticket.id_user 
        } 
        return this.sendLogMessages(payload, "tickets_log_channel", "Ticket Created", '#00FF44', [ticket.guild_id]);

    }
    
    async onTicketClose(payload) {

        const creator = new ScrimsUser(this.database, payload?.ticket?.user)
        const msg = `Closed a ${payload?.ticket?.type?.name} ticket from ${creator?.getMention('**') ?? 'an **unknown user**'} with an id of \`${payload?.ticket?.id_ticket}\`.`
        return this.sendLogMessages({ msg, mentions: [creator?.discordUser], ...payload }, "tickets_log_channel", "Ticket Closed", '#CF1117', [payload.guild_id]);

    }

}

module.exports = LoggingFeature;