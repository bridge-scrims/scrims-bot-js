
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, MessageAttachment, BaseMessageComponent } = require("discord.js");
const ScrimsMessageBuilder = require("../lib/responses");

class PositionsResponseMessageBuilder extends ScrimsMessageBuilder {

    static syncViolet = "#673AB7"

    static positionRolesStatusMessage(positionRoles) {

        return { 

            ephemeral: true,
            components: [],
            embeds: this.createMultipleEmbeds(positionRoles, (positionRoles, idx, containers) => (
                new MessageEmbed()
                    .setTitle("Connected Roles")
                    .setColor(this.syncViolet)
                    .setDescription(positionRoles.map(posRole => `\`•\`${posRole.role} -> **${posRole.position.name}** (${posRole.id_position})`).join("\n"))
                    .setFooter({ text: `Page ${idx+1}/${containers.length}` })
                    .setTimestamp(Date.now())
            ))

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
                    .setDescription(userPositions.map(userPos => `\`•\` **${userPos.position.name}** (${getUserPositionExpiration(userPos)})`).join("\n"))
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