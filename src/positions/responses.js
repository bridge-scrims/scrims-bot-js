
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");
const ScrimsPosition = require("../lib/scrims/position");
const ScrimsPositionRole = require("../lib/scrims/position_role");

class PositionsResponseMessageBuilder extends ScrimsMessageBuilder {

    static syncViolet = "#673AB7"

    static positionRolesStatusMessage(positionRoles, guild_id) {

        if (positionRoles.length === 0) 
            return { ephemeral: true, components: [], content: "No position roles configured." };

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

    static getUserPositionsMessage(user, userPositions) {

        const userName = user.username.endsWith('s') ? user.username : `${user.username}'s`;
        const getUserPositionExpiration = userPos => (userPos.expires_at === null) ? `never expires` : `expires <t:${userPos.expires_at}:R>`;
        return { 

            ephemeral: true,
            components: [],
            embeds: this.createMultipleEmbeds(userPositions, (userPositions, idx, containers) => (
                new MessageEmbed()
                    .setTitle(`${userName} Positions`)
                    .setColor(this.syncViolet)
                    .setDescription(userPositions.map(userPos => `\`•\` **${userPos.position?.name}** (${getUserPositionExpiration(userPos)})`).join("\n"))
                    .setFooter({ text: `Page ${idx+1}/${containers.length}` })
                    .setTimestamp(Date.now())
            ))

        };

    }

    static positionRolesAddConfirmMessage(existing, role, position) {

        return { 

            ephemeral: true,
            content: `${role} is already connected to the bridge scrims position **${existing.position.name}**. Would you like to overrite this?`,
            components: [ 
                new MessageActionRow()
                    .addComponents(
                        this.button(`Overrite`, 4, `PositionRoles/overwrite/${role.id}/${position.id_position}`),
                        this.cancelButton(),
                    ) 
            ],
            embeds: []

        };

    }
    
}

module.exports = PositionsResponseMessageBuilder;