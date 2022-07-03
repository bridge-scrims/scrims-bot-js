const { MessageEmbed, TextChannel } = require("discord.js");
const PositionLoggingFeature = require("./positions");
const ScrimsUser = require("../lib/scrims/user");
const ScrimsTicket = require("../lib/scrims/ticket");
const ScrimsGuildEntry = require("../lib/scrims/guild_entry");

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
        this.database.ipc.on('scrims_suggestion_create', message => this.onSuggestionCreate(message.payload).catch(console.error))

        this.database.ipc.on('audited_config_create', message => this.onConfigCreate(message.payload).catch(console.error))
        this.database.ipc.on('audited_config_remove', message => this.onConfigRemove(message.payload).catch(console.error))

        this.database.ipc.on('ticket_error', message => this.onTicketError(message.payload).catch(console.error))
        this.database.ipc.on('ticket_success', message => this.onTicketSuccess(message.payload).catch(console.error))
        this.database.ipc.on('scrims_ticket_create', message => this.onTicketCreate(message.payload).catch(console.error))
        this.database.ipc.on('ticket_closed', message => this.onTicketClose(message.payload).catch(console.error))

    }

    getUser(id_user, discord_id) {

        if (!id_user && !discord_id) return null;
        return this.database.users.cache.find((id_user ? { id_user } : { discord_id }));

    }

    getFooterData(payload) {

        if (payload.guild_id) {

            const guild = this.database.guilds.cache.find({ guild_id: payload.guild_id })
            if (guild) return { text: guild.name, iconURL: guild.iconURL() };

        }

        if (payload.suggestion?.guild_id) {

            const guild = this.database.guilds.cache.find({ guild_id: payload.suggestion.guild_id })
            if (guild) return { text: guild.name, iconURL: guild.iconURL() };

        }

        if (payload.positionRole?.guild_id) {

            const guild = this.database.guilds.cache.find({ guild_id: payload.positionRole.guild_id })
            if (guild) return { text: guild.name, iconURL: guild.iconURL() };

        }

        if (payload.guild_id === undefined) return null;

        return { text: "Unknown Guild", iconURL: this.defaultURL() };

    }

    getAuthorData(payload, effect="") {

        if (payload.executor_id) {

            const user = this.database.users.cache.find({ discord_id: payload.executor_id })
            if (user) return { name: user.tag || 'Unknown User', iconURL: user.avatarURL() ?? this.defaultURL(), mention: user.discordUser };

        }

        if (payload.id_executor) {

            const user = this.database.users.cache.find({ id_user: payload.id_executor })
            if (user) return { name: user.tag || 'Unknown User', iconURL: user.avatarURL() ?? this.defaultURL(), mention: user.discordUser };

        }
        
        if (payload.executor_id === undefined && payload.id_executor === undefined) return null;

        return { name: `${effect}Unknown User${effect}`, iconURL: this.defaultURL() };

    }

    stringifyUpdate(oldValue, update) {

        return Object.entries(update)
            .map(([key, value]) => `\`•\` **${key}:** \`${oldValue[key] ?? 'none'}\` **->** \`${value}\``).join("\n ")

    }

    /**
     * @returns { Promise<TextChannel[]> }
     */
    async getChannels(configKey, guilds) {

        const configured = this.database.guildEntrys.cache.get({ type: { name: configKey } })
            .filter(config => config.discordGuild && config.value && (!guilds || guilds.includes(config.guild_id)))
        
        return Promise.all(configured.map(config => config.discordGuild.channels.fetch(config.value).catch(() => null)))
            .then(channels => channels.filter(channel => channel && channel.type === "GUILD_TEXT"));

    }

    async sendLogMessages(payload, configKey, title, color, guilds) {

        if (!payload.msg) return;

        const footerData = this.getFooterData(payload)
        const authorData = this.getAuthorData(payload)

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

        if (payload.error) embed.addField(payload.error?.name || 'Error', `${payload.error?.message || 'Unknown error.'}`, false)
        if (payload.update && payload.oldValue) embed.addField("Updates", this.stringifyUpdate(payload.oldValue, payload.update))

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

    async onConfigCreate(payload) {

        const guildEntry = new ScrimsGuildEntry(this.database, payload.entry)
        payload.msg = `Configured **${guildEntry.type.name}** ` 
            + ((payload.oldValue) ? `from \`${payload.oldValue}\` ` : '') + `to \`${guildEntry.value}\`.`
        
        payload.guild_id = guildEntry.guild_id

        return this.sendLogMessages(payload, "config_log_channel", "Bot Configuration", '#00ffb8');

    }

    async onConfigRemove(payload) {

        const guildEntry = new ScrimsGuildEntry(this.database, payload.entry)
        payload.msg = `Unconfigured **${guildEntry.type.name}** from \`${guildEntry.value}\`.` 

        payload.guild_id = guildEntry.guild_id
        
        return this.sendLogMessages(payload, "config_log_channel", "Bot Configuration", '#ff0067');

    }

    async onSuggestionRemove(payload) {

        const executorIsCreator = (payload?.executor_id === payload?.suggestion?.creator?.discord_id)
        const rating = (() => {
            const guild = this.bot.guilds.cache.get(payload.suggestion?.guild_id)
            if (!this.bot.suggestions || !payload.rating || !guild) return "";
            const [suggestionUpVote, suggestionDownVote] = this.bot.suggestions.getVoteEmojis(guild)
            return ` with **${payload.rating.upVotes}**${suggestionUpVote}  and  **${payload.rating.downVotes}**${suggestionDownVote}`;
        })()

        const msg = (executorIsCreator ? `Removed their own suggestion${rating}.` : `Removed a suggestion${rating}.`)
        return this.sendLogMessages({ msg, ...payload }, "suggestions_log_channel", "Suggestions Remove", '#fc2344', [payload?.suggestion?.guild_id]);

    }

    async onSuggestionCreate(suggestion) {

        const payload = { msg: "Created a suggestion.", executor_id: suggestion?.creator?.discord_id, suggestion }
        return this.sendLogMessages(payload, "suggestions_log_channel", "Suggestions Create", '#23cf6e', [suggestion?.guild_id]);
        
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