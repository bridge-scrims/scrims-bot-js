const { Role } = require("discord.js");
const ScrimsPosition = require("../lib/scrims/position");
const ScrimsPositionRole = require("../lib/scrims/position_role");
const PositionsResponseMessageBuilder = require("./responses");

const subCmdHandlers = {

    "status": onStatusSubcommand,
    "reload": onReloadSubcommand,
    "add": onAddSubcommand,
    "remove": onRemoveSubcommand,
    "overwrite": onConfirmComponent

}

async function onCommand(interaction) {

    const handlerIdentifier = interaction?.options?.getSubcommand() || interaction.args.shift()
    const subcommandHandler = subCmdHandlers[handlerIdentifier]   
    if (subcommandHandler) return subcommandHandler(interaction);
        
    await interaction.reply({ content: "How did we get here?", ephemeral: true });

}

async function getPosition(interaction) {

    const positionId = interaction?.options?.getInteger("position") || interaction?.args?.shift()
    const position = interaction.client.database.positions.cache.resolve(positionId)
    if (!position) {
 
        return interaction.send(
            PositionsResponseMessageBuilder.errorMessage(`Invalid Position`, `Please pick a valid bridge scrims position and try again!`)
        ).then(() => false);

    }
    return position;

}

function sortPositionRoles(positionRoles) {

    return positionRoles.sort((a, b) => a.level - b.level);

}

async function hasPositionPermissions(interaction, position, action) {

    if (typeof position.level === "number") {

        // For example if staff wants to change the roll for owner position
        if (!(interaction.member.hasPermission(position.name))) {

            return interaction.editReply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(interaction.i18n, `You are not allowed to ${action}!`)
            ).then(() => false);

        } 
            
    }

    return true;

}

/**
 * @param {import("../types").ScrimsCommandInteraction} interaction 
 */
async function onStatusSubcommand(interaction) {

    const guild_id = interaction.options.getString("guild") ?? interaction.guild.id

    const positionRoles = interaction.client.database.positionRoles.cache.get({ guild_id })
    const sortedPositionRoles = sortPositionRoles(positionRoles)
    await interaction.reply(PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles, interaction.guild.id))

}

/**
 * @param {import("../types").ScrimsCommandInteraction} interaction 
 */
async function onReloadSubcommand(interaction) {

    await interaction.deferReply({ ephemeral: true })

    await interaction.client.database.positions.initializeCache()
    await interaction.client.database.userPositions.initializeCache()
    await interaction.client.database.positionRoles.initializeCache()

    const positionRoles = interaction.client.database.positionRoles.cache.get({ guild_id: interaction.guild.id })
    const sortedPositionRoles = sortPositionRoles(positionRoles)

    const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles, interaction.guild.id)
    await interaction.editReply({ ...payload, content: `Bridge scrims positions, user-positions and position-roles reloaded.`, ephemeral: true })

}

/**
 * @param {import("../types").ScrimsCommandInteraction|import("../types").ScrimsComponentInteraction} interaction 
 * @param {Role} role
 * @param {ScrimsPosition} position
 * @param {string} guild_id
 */
async function addPositionRole(interaction, role, position, guild_id) {

    if (!(await hasPositionPermissions(interaction, position, `connect anything to bridge scrims **${position.name}** position`))) return false;

    const positionRole = new ScrimsPositionRole(interaction.client.database).setPosition(position).setRole(role).setGuild(guild_id)
    const result = await interaction.client.database.positionRoles.create(positionRole).catch(error => error)
    if (result instanceof Error) {

        console.error(`Unable to create position role because of ${result}!`)
        return interaction.editReply(PositionsResponseMessageBuilder.failedMessage(`create a new position role`))

    }

    interaction.client.database.ipc.notify('audited_position_role_create', { executor_id: interaction.user.id, positionRole: result })

    const positionRoles = interaction.client.database.positionRoles.cache.get({ guild_id })
    const sortedPositionRoles = sortPositionRoles(positionRoles)
    const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles, interaction.guild.id)

    const warning = (
        interaction.client.hasRolePermissions(role) ? `` 
        : `\n_ _\n ⚠️ ${interaction.client.user} is missing permissions to give/remove this role! `
            + `\nMake sure that ${interaction.client.user} has permission to manage roles, and that in `
            + `**Server Settings** -> **Roles** ${interaction.client.user} is above ${role}.`
    )

    await interaction.editReply({ 
        ...payload, content: `${role} is now connected to bridge scrims **${position.name}**. ${warning}`, 
        allowedMentions: { parse: [] },
        ephemeral: true 
    })

}

/**
 * @param {import("../types").ScrimsCommandInteraction} interaction 
 */
async function onAddSubcommand(interaction) {

    const role = interaction.options.getRole("role")
    const guild_id = interaction.guild.id

    const position = await getPosition(interaction)
    if (!position) return false;

    await interaction.deferReply({ ephemeral: true })

    const existing = interaction.client.database.positionRoles.cache.find({ guild_id, role_id: role.id })
    if (existing && existing.id_position === position.id_position) {

        const positionRoles = interaction.client.database.positionRoles.cache.get({ guild_id })
        const sortedPositionRoles = sortPositionRoles(positionRoles)
        const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles, interaction.guild.id)
        return interaction.editReply({ 
            ...payload, content: `${role} is already connected to bridge scrims **${position.name}**!`, 
            allowedMentions: { parse: [] },
            ephemeral: true 
        });

    }

    if (existing)
        return interaction.editReply(PositionsResponseMessageBuilder.positionRolesAddConfirmMessage(existing, role, position));

    await addPositionRole(interaction, role, position, guild_id)
    
}

/**
 * @param {import("../types").ScrimsComponentInteraction} interaction 
 */
async function onConfirmComponent(interaction) {

    await interaction.update({ content: "Overwriting...", embeds: [], components: [] })

    const roleId = interaction.args.shift()
    const role = interaction.guild.roles.resolve(roleId)
    if (!role) 
        return interaction.editReply(PositionsResponseMessageBuilder.errorMessage(`Invalid Role`, `Please pick a valid discord role and try again.`));

    const position = await getPosition(interaction)
    if (!position) return false;

    const guild_id = interaction.guild.id

    const success = await removePositionRoles(interaction, position, { guild_id, role_id: roleId })
    if (!success) return false;

    await addPositionRole(interaction, role, position, guild_id)

}

/**
 * @param {import("../types").ScrimsCommandInteraction|import("../types").ScrimsComponentInteraction} interaction 
 * @param {ScrimsPosition} position 
 * @param {Object.<string, any>} selector 
 */
async function removePositionRoles(interaction, position, selector) {

    if (!(await hasPositionPermissions(interaction, position, `connect anything to bridge scrims **${position.name}** position`))) return false;
    
    const result = await interaction.client.database.positionRoles.remove(selector).catch(error => error)
    if (result instanceof Error) {

        console.error(`Unable to remove position roles because of ${result}!`)
        return interaction.editReply(PositionsResponseMessageBuilder.failedMessage(`remove position roles`)).then(() => false);

    }

    interaction.client.database.ipc.notify('audited_position_role_remove', { executor_id: interaction.user.id, selector })
    return true;

}

async function getOptionalPosition(interaction) {

    if (interaction.options.getInteger("position") !== null) return getPosition(interaction);
    return null;

}

/**
 * @param {import("../types").ScrimsCommandInteraction} interaction  
 */
async function onRemoveSubcommand(interaction) {

    const role = interaction.options.getRole("role")
    const guild_id = interaction.guild.id

    const position = await getOptionalPosition(interaction)
    if (position === false) return false;

    const positionFilter = position ? { id_position: position.id_position } : { };
    const selector = { guild_id, role_id: role.id, ...positionFilter }
    
    const existing = interaction.client.database.positionRoles.cache.find(selector)
    if (!existing) {

        const message = `${role} is not connected to ${position ? `bridge scrims **${position.name}**!` : `any bridge scrims positions!`}`;
        return interaction.reply(PositionsResponseMessageBuilder.errorMessage(`Not Connected`, message));

    }

    await interaction.deferReply({ ephemeral: true })

    const success = await removePositionRoles(interaction, existing.position, selector)
    if (!success) return false;

    const positionRoles = interaction.client.database.positionRoles.cache.get({ guild_id })
    const sortedPositionRoles = sortPositionRoles(positionRoles)
    const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles, interaction.guild.id)
    const message = `${role} was unconnected from ${position ? `bridge scrims **${position.name}**.` : `any bridge scrims positions.`}`
    await interaction.editReply({ ...payload, content: message, allowedMentions: { parse: [] }, ephemeral: true });

}

module.exports = onCommand;