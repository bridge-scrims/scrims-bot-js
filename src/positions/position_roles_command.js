const ScrimsPositionRole = require("../lib/scrims/position_role");
const PositionsResponseMessageBuilder = require("./responses");
const UserError = require("../lib/tools/user_error");

const subCmdHandlers = {

    "status": onStatusSubcommand,
    "reload": onReloadSubcommand,
    "add": onAddSubcommand,
    "remove": onRemoveSubcommand,
    "button": onComponent,

}

async function onCommand(interaction) {

    const handlerIdentifier = interaction?.options?.getSubcommand() || interaction.args.shift()
    const subcommandHandler = subCmdHandlers[handlerIdentifier]   
    if (subcommandHandler) return subcommandHandler(interaction);
        
    await interaction.reply({ content: "How did we get here?", ephemeral: true });

}

function getPosition(interaction) {

    const positionId = interaction?.options?.getInteger("position") || interaction?.args?.shift()
    const position = interaction.client.database.positions.cache.resolve(positionId)
    if (!position) throw new UserError(`Invalid Position`, `Please pick a valid bridge scrims position and try again!`);
    return position;

}

function sortPositionRoles(positionRoles) {

    return positionRoles.sort((a, b) => a.level - b.level);

}

function verifyPositionPermissions(interaction, position, action) {

    if (typeof position.level === "number") {
        // For example if staff wants to change the roll for owner position
        if (!(interaction.scrimsPositions.hasPositionLevel(position)))
            throw new UserError(PositionsResponseMessageBuilder.missingPermissionsMessage(interaction.i18n, `You are not allowed to ${action}!`));
    }

}

function getFinishPayload(interaction, content) {

    const positionRoles = interaction.client.database.positionRoles.cache.get({ guild_id: interaction.guildId })
    const sortedPositionRoles = sortPositionRoles(positionRoles)
    if (sortedPositionRoles.length === 0 && content === null) return { content: `Guild has no position roles.`, ephemeral: true };

    const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles, interaction.guildId)
    return { ...payload, content, allowedMentions: { parse: [] }, ephemeral: true };

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onStatusSubcommand(interaction) {

    const guild_id = interaction.options.getString("guild")
    if (guild_id) interaction.guildId = guild_id

    await interaction.reply(getFinishPayload(interaction, null))

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
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
 * @param {ScrimsPositionRole} positionRole 
 */
async function addPositionRole(interaction, positionRole) {

    verifyPositionPermissions(interaction, positionRole.position, `connect anything to bridge scrims **${positionRole.position.name}** position`)

    const created = await interaction.client.database.positionRoles.create(positionRole)
    interaction.client.database.ipc.notify('audited_position_role_create', { executor_id: interaction.user.id, positionRole: created })

    const warning = (
        interaction.client.hasRolePermissions(created.role) ? `` 
        : `\n_ _\n ⚠️ ${interaction.client.user} is missing permissions to give/remove this role! `
            + `\nMake sure that ${interaction.client.user} has permission to manage roles, and that in `
            + `**Server Settings** -> **Roles** ${interaction.client.user} is above ${created.role}.`
    )

    await interaction.editReply(getFinishPayload(interaction, `${created.role} is now connected to bridge scrims **${created.position.name}**. ${warning}`))

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onAddSubcommand(interaction) {

    const role = interaction.options.getRole("role")
    const position = getPosition(interaction)
     
    await interaction.deferReply({ ephemeral: true })

    const existing = interaction.client.database.positionRoles.cache.get({ guild_id: interaction.guild.id, role_id: role.id })
    if (existing.map(v => v.id_position).includes(position.id_position))
        return interaction.editReply(getFinishPayload(interaction, `${role} is already connected to bridge scrims **${position.name}**!`));

    if (existing.length === 1)
        return interaction.editReply(PositionsResponseMessageBuilder.positionRolesAddConfirmMessage(existing[0], role, position));

    await addPositionRole(interaction, new ScrimsPositionRole(interaction.database).setRole(role).setPosition(position).setGuild(interaction.guild))

    
}

const componentHandlers = {

    join: onJoinComponent,
    replace: onReplaceComponent

}

/** @param {import("../types").ScrimsComponentInteraction} interaction */
async function onComponent(interaction) {

    await interaction.update({ content: "Processing...", embeds: [], components: [] })

    const roleId = interaction.args.shift()
    const role = interaction.guild.roles.resolve(roleId)
    if (!role) throw new UserError(`Invalid Role`, `Please pick a valid discord role and try again.`);

    const position = getPosition(interaction)
    const positionRole = new ScrimsPositionRole(interaction.database).setRole(role).setPosition(position).setGuild(interaction.guild.id)

    const handler = componentHandlers[interaction.args.shift()]
    if (handler) await handler(interaction, positionRole)

}

/** 
 * @param {import("../types").ScrimsComponentInteraction} interaction 
 * @param {ScrimsPositionRole} positionRole
 */
async function onJoinComponent(interaction, positionRole) {

    await addPositionRole(interaction, positionRole)

}

/** 
 * @param {import("../types").ScrimsComponentInteraction} interaction 
 * @param {ScrimsPositionRole} positionRole
 */
async function onReplaceComponent(interaction, positionRole) {

    const position = getPosition(interaction)

    await removePositionRole(interaction, positionRole.clone().setPosition(position))
    await addPositionRole(interaction, positionRole)

}

/**
 * @param {import("../types").ScrimsCommandInteraction|import("../types").ScrimsComponentInteraction} interaction 
 * @param {ScrimsPositionRole} positionRole 
 */
async function removePositionRole(interaction, positionRole) {

    verifyPositionPermissions(interaction, positionRole.position, `connect anything to bridge scrims **${positionRole.position.name}** position`)
    
    const removed = await interaction.client.database.positionRoles.remove(positionRole)
    if (removed.length > 0) interaction.client.database.ipc.notify('audited_position_role_remove', { executor_id: interaction.user.id, selector: positionRole })

}

function getOptionalPosition(interaction) {

    if (interaction.options.getInteger("position") !== null) return getPosition(interaction);
    return null;

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onRemoveSubcommand(interaction) {

    await interaction.deferReply({ ephemeral: true })

    const role = interaction.options.getRole("role")
    const position = getOptionalPosition(interaction)
    const selector = { guild_id: interaction.guild.id, role_id: role.id, ...(position ? { id_position: position.id_position } : {}) }
    
    const existing = interaction.client.database.positionRoles.cache.get(selector)
    if (existing.length === 0) 
        throw new UserError(`Not Connected`, `${role} is not connected to ${position ? `bridge scrims **${position.name}**!` : `any bridge scrims positions!`}`);

    await Promise.all(existing.map(existing => removePositionRole(interaction, existing).catch(console.error)))
    await interaction.editReply(getFinishPayload(interaction, `${role} was unconnected from ${position ? `bridge scrims **${position.name}**.` : `any bridge scrims positions.`}`));

}

module.exports = onCommand;