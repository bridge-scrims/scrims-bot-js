
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent, GuildMember, Guild } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");
const ScrimsPosition = require("../lib/scrims/position");
const ScrimsPositionRole = require("../lib/scrims/position_role");
const ScrimsUser = require("../lib/scrims/user");
const ScrimsUserPosition = require("../lib/scrims/user_position");

class PositionsResponseMessageBuilder extends ScrimsMessageBuilder {

    static syncViolet = "#673AB7"

    static positionRolesStatusMessage(positionRoles, guild_id) {

        if (positionRoles.length === 0) 
            return { ephemeral: true, components: [], content: "No position roles configured." };

        positionRoles = positionRoles.sort(ScrimsPositionRole.sortByLevel)
        const getRoleMention = (role) => (role.guild.id === guild_id) ? `${role}` : `@${role.name}`;

        return { 

            ephemeral: true,
            components: [],
            embeds: this.createMultipleEmbeds(positionRoles, (positionRoles, idx, containers) => (
                new MessageEmbed()
                    .setTitle("Connected Roles")
                    .setColor(this.syncViolet)
                    .setDescription(positionRoles.map(posRole => `\`•\`${getRoleMention(posRole.role)} -> **${posRole.position.name}** (${posRole.id_position})`).join("\n"))
                    .setFooter({ text: `Page ${idx+1}/${containers.length}` })
                    .setTimestamp(Date.now())
            ))

        };

    }

    static getPositionsInfoMessage(positions, userPositions) {

        positions = positions.sort(ScrimsPosition.sortByLevel)
        const getDetails = (pos) => `\`ID:\` ${pos.id}, \`Level:\` **${pos.level ?? '*None*'}**, \`Sticky:\` ${pos.sticky}, \`Members:\` **${userPositions.filter(v => v.id_position === pos.id_position).length}**`;

        return { 

            ephemeral: true,
            components: [],
            embeds: this.createMultipleEmbeds(positions, (positions, idx, containers) => (
                new MessageEmbed()
                    .setTitle(`Bridge Scrims Positions`)
                    .setColor(this.syncViolet)
                    .setDescription(positions.map(pos => `\`•\` **${pos.name}** ${getDetails(pos)}`).join("\n"))
                    .setFooter({ text: `Page ${idx+1}/${containers.length}` })
            ))

        };

    }

    /**
     * @param { ScrimsPosition } position 
     * @param { ScrimsPositionRole } positionRole
     */
    static getPositionInfoMessage(position, positionRole, userPositions) {

        return { 

            ephemeral: true,
            components: [],
            embeds: [
                new MessageEmbed()
                    .setTitle(`${position.capitalizedName} Position`)
                    .setColor(positionRole?.role?.hexColor || this.syncViolet)
                    .setDescription(
                        ((positionRole?.role) ? `\`Connected to:\` ${positionRole.role}\n` : '')
                        + `\`ID:\` **${position.id}**\n\`Level:\` **${position.level ?? '*None*'}**\n`
                        + `\`Sticky:\` **${position.sticky}**\n\`Members:\` **${userPositions.filter(v => v.id_position === position.id_position).length}**`
                    )
            ]

        };

    }

    /** 
     * @param {ScrimsUser} scrimsUser 
     * @param {Guild} [member] 
     */
    static getUserPositionsMessage(scrimsUser, userPositions, guild) {

        userPositions = userPositions.filter(ScrimsUserPosition.removeExpired).sort(ScrimsUserPosition.sortByLevel)
        const username = scrimsUser.discord_username
        return { 

            ephemeral: false,
            components: [],
            content: scrimsUser?.discordUser ? `${scrimsUser?.discordUser }` : null,
            embeds: this.createMultipleEmbeds(userPositions, (userPositions, idx, containers) => (
                new MessageEmbed()
                    .setAuthor({ name: `${(username.endsWith('s') ? `${username}'` : `${username}'s`)} Positions`, iconURL: scrimsUser.avatarURL() })
                    .setColor(scrimsUser.getMember(guild)?.displayColor ?? "#FFFFFF")
                    .setDescription(userPositions.map(userPos => `\`•\` ${userPos.toString(guild?.id)}`).join("\n"))
                    .setFooter({ text: `Page ${idx+1}/${containers.length}` })
            )),
            allowedMentions: { parse: [] }

        };

    }

    static positionRolesAddConfirmMessage(existing, role, position) {

        return { 
            ephemeral: true,
            content: `${role} is already connected to bridge scrims **${existing.position.name}**. Are you sure you want to add this?`,
            components: [ 
                new MessageActionRow()
                    .addComponents(
                        this.button(`Add`, 3, `PositionRoles/button/${role.id}/${position.id_position}/join`),
                        this.button(`Replace`, 4, `PositionRoles/button/${role.id}/${position.id_position}/replace/${existing.id_position}`),
                        this.cancelButton(),
                    ) 
            ],
            embeds: []
        };

    }
    
}

module.exports = PositionsResponseMessageBuilder;