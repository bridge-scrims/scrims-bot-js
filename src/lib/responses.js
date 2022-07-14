const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent, GuildMember, Guild, SnowflakeUtil } = require("discord.js");
const I18n = require("./tools/internationalization");
const ScrimsUser = require("./scrims/user");
const UserError = require("./tools/user_error");

class ScrimsMessageBuilder {

    static warningYellow = "#EBB611"
    static successGreen = "#00DB0E"
    static errorRed = "#DC0023"

    static intrestingAqua = "#15EFFF"

    /**
     * @param {string} resolvable 
     * @param {ScrimsUser[]} scrimsUsers 
     * @param {Guild} guild 
     * @returns {ScrimsUser|GuildMember|null}
     */
    static parseUser(resolvable, scrimsUsers, guild) {

        resolvable = resolvable.replace(/```|:|\n|@/g, '')

        let matches = scrimsUsers.filter(user => user.id_user === resolvable || user.discord_id === resolvable || user.tag === resolvable)
        if (matches.length === 1) return matches[0];

        if (guild) {

            const members = [...guild.members.cache.values()]

            matches = members.filter(user => user.displayName === resolvable)
            if (matches.length === 1) return matches[0].user;

        }

        matches = scrimsUsers.filter(user => user.discord_username === resolvable)
        if (matches.length === 1) return matches[0];

        matches = scrimsUsers.filter(user => user.tag && user.tag.toLowerCase() === resolvable.toLowerCase())
        if (matches.length === 1) return matches[0];

        return null;

    }
    
    /**
     * @param { string } text 
     */
    static stripText(text, charLimit) {

        while (text.includes("\n\n\n")) 
            text = text.replace("\n\n\n", "\n\n");

        const lines = text.split("\n").map(v => v.trim())
        if (lines.length > 10)
            text = lines.slice(0, lines.length-(lines.length-10)).join("\n") + lines.slice(lines.length-(lines.length-10)).map(v => v.trim()).join(" ")
        
        text = text.trim()
        if (text.length > charLimit) text = text.slice(0, charLimit-12) + " ...and more"
        return text;
        
    }

    static hsv2rgb(h, s, v) {
        const i = Math.floor((h/360)*6)
        const a = v * (1 - s)
        const b = v * (1 - s * ((h/360)*6 - i))
        const c = v * (1 - s * (1 - ((h/360)*6 - i)))
    
        const values = (() => {
            if (i === 0) return [ v, c, a ];
            if (i === 1) return [ b, v, a ];
            if (i === 2) return [ a, v, c ];
            if (i === 3) return [ a, b, v ];
            if (i === 4) return [ c, a, v ];
            if (i === 5) return [ v, a, b ];
        })()
    
        return values.map(v => v*255);
    }

    /**
     * @param { any[] } array
     */
    static stringifyArray(array) {

        return [array.slice(0, -1).join(', '), array.slice(-1)[0]].filter(v => v).join(' and ');

    }

    static errorMessage(title, description) {

        return {
            ephemeral: true,
            components: [],
            content: null,
            embeds: [
                new MessageEmbed()
                    .setColor(this.errorRed)
                    .setTitle(title)
                    .setDescription(description)
            ]
        };

    }

    static warningMessage(title, description) {

        return {
            ephemeral: true,
            components: [],
            content: null,
            embeds: [
                new MessageEmbed()
                    .setColor(this.warningYellow)
                    .setTitle(title)
                    .setDescription(description)
            ]
        };

    }

    static button(label, style, customId) {

        return new MessageButton()
            .setLabel(label)
            .setStyle(style)
            .setCustomId(customId);

    }

    static cancelButton(i18n=I18n.getInstance()) {

        return new MessageButton().setLabel(i18n.get('cancel')).setStyle(2).setCustomId(`CANCEL`); 

    }

    /**
     * Creates a `Command Failed` message payload.
     * 
     * @param {string} action (Unable to **action** at the moment) 
     */
    static failedMessage(action) {

        return this.errorMessage(`Command Failed`, `Unable to ${action} at the moment. Please try again later.`);

    }

    static guildOnlyMessage(i18n=I18n.getInstance()) {

        return this.errorMessage(i18n.get("guild_only_title"), i18n.get("guild_only"));
    
    }

    static scrimsUserNeededMessage(i18n=I18n.getInstance()) {

        return this.errorMessage(i18n.get("missing_scrims_user_title"), i18n.get("missing_scrims_user"));
    
    }

    static missingPermissionsMessage(i18n, message) {

        return this.errorMessage(i18n.get("missing_permissions"), message);
    
    }

    static unexpectedFailureMessage(i18n, message) {

        return this.errorMessage(i18n.get("unexpected_failure_title"), message);

    }

    static configEntrysMessage(configEntrys) {

        return { 

            ephemeral: true,
            components: [],
            embeds: this.createMultipleEmbeds(configEntrys, (configEntrys, idx, containers) => (
                new MessageEmbed()
                    .setTitle("Guild Config")
                    .setColor(this.intrestingAqua)
                    .setDescription(configEntrys.map(config => `\`•\` **${config.type.name}:** \`${config.value}\``).join("\n"))
                    .setFooter({ text: `Page ${idx+1}/${containers.length}` })
                    .setTimestamp(Date.now())
            ))

        };

    }

    /**
     * @template T
     * @param { T[] } items 
     * @param { (items: T[], index: number, containers: T[][]) => MessageEmbed } getEmbed
     */
    static createMultipleEmbeds(items, getEmbed) {
        
        const max = 25
        
        const containers = Array.from((new Array(Math.ceil(items.length / max))).keys())
        if (containers.length > 10) {
            console.error(new Error(`Someone tried to fit ${items.length} items into a single message :/`))
            throw new UserError(
                "There is too much!", `Unfortunately, I am unable to fit all \`${items.length}\` items into this message. `
                    + `The bridge scrims **developer team have been alerted** and will be finding an alternative way to display your items. `
                    + `In the meantime **please refrain from using this command again**.`
            )
        }

        const containerSize = Math.floor(items.length / containers.length)
        const overflow = items.length % containerSize
        const embedData = containers.map((_, i) => items.slice(i*containerSize, (i+1)*containerSize+1))

        const lastIdx = embedData.length-1
        if (overflow > 0) embedData[lastIdx] = embedData[lastIdx].concat(items.slice(-overflow))

        return embedData.map((items, idx, containers) => getEmbed(items, idx, containers))

    }
    
}

module.exports = ScrimsMessageBuilder;