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
    const position = interaction.client.database.positions.cache.get({ id_position: positionId })[0]
    if (!position) {

        return interaction.reply(
            PositionsResponseMessageBuilder.errorMessage(`Invalid Position`, `Please pick a valid bridge scrims position and try again!`)
        ).then(() => false);

    }
    return position;

}

function sortPositionRoles(interaction, positionRoles) {

    return positionRoles
        .sort((a, b) => a.id_position - b.id_position)
        .map(posRole => ({ ...posRole, role: interaction.guild.roles.resolve(posRole.role_id) }))
        .filter(posRole => posRole.role);

}

async function hasPositionPermissions(interaction, position, action) {

    if (typeof position.level === "number") {

        // For example if staff wants to change the roll for owner position
        if (!(await interaction.client.permissions.hasPermissionLevel(interaction.member, position.name))) {

            return interaction.editReply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(`You are not allowed to ${action}!`)
            ).then(() => false);

        } 
            
    }

    return true;

}

async function onStatusSubcommand(interaction) {

    const positionRoles = await interaction.client.database.positionRoles.get({ scrimsGuild: { discord_id: interaction.guild.id } }, false).catch(error => error)
    const sortedPositionRoles = sortPositionRoles(interaction, positionRoles)
    await interaction.reply(PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles))

}

async function onReloadSubcommand(interaction) {

    await interaction.deferReply({ ephemeral: true })

    const positionRoles = await interaction.client.database.positionRoles.get({ scrimsGuild: { discord_id: interaction.guild.id } }, false).catch(error => error)
    const result = await interaction.client.database.positions.get({ }, false).catch(error => error)
    
    const error = (positionRoles instanceof Error) ? positionRoles : result
    if (error instanceof Error) {

        console.error(`Unable to reload positions because of ${error}!`)
        return interaction.editReply(PositionsResponseMessageBuilder.failedMessage(`reload the positions`));

    }

    const sortedPositionRoles = sortPositionRoles(interaction, positionRoles)
    const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles)
    await interaction.editReply({ ...payload, content: `Bridge scrims positions reloaded.`, ephemeral: true })

}

async function addPositionRole(interaction, role, position) {

    if (!(await hasPositionPermissions(interaction, position, `connect anything to bridge scrims **${position.name}** position`))) return false;

    const positionRole = { id_position: position.id_position, role_id: role.id, scrimsGuild: { discord_id: interaction.guild.id } }
    const result = await interaction.client.database.positionRoles.create(positionRole).catch(error => error)
    if (result instanceof Error) {

        console.error(`Unable to create position role because of ${result}!`)
        await interaction.editReply(PositionsResponseMessageBuilder.failedMessage(`create a new position role`))

    }

    interaction.client.database.ipc.notify('audited_position_role_create', { executor_id: interaction.user.id, positionRole: result })

    const positionRoles = interaction.client.database.positionRoles.cache.get({ scrimsGuild: { discord_id: interaction.guild.id } })
    const sortedPositionRoles = sortPositionRoles(interaction, positionRoles)
    const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles)

    const warning = (
        interaction.client.positions.botHasRolePermissions(role) ? `` 
        : `\n_ _\n ⚠️ ${interaction.client.user} is missing permissions to give/remove this role!`
            + `\n To fix this in **Server Settings** -> **Roles** drag ${interaction.client.user} above ${role}.`
    )

    await interaction.editReply({ 
        ...payload, content: `${role} is now connected to bridge scrims **${position.name}**. ${warning}`, 
        allowedMentions: { parse: [] },
        ephemeral: true 
    })

}

async function onAddSubcommand(interaction) {

    const role = interaction.options.getRole("role")

    const position = await getPosition(interaction)
    if (!position) return false;

    await interaction.deferReply({ ephemeral: true })

    const existing = await interaction.client.database.positionRoles.get({ scrimsGuild: { discord_id: interaction.guild.id }, role_id: role.id }).catch(error => error)
    if (existing instanceof Error) {

        console.error(`Unable to get existing position roles ${existing}!`)
        return interaction.editReply(PositionsResponseMessageBuilder.failedMessage(`get the position roles`));

    }

    if (existing.filter(posRole => posRole.id_position == position.id_position).length > 0) {

        const positionRoles = interaction.client.database.positionRoles.cache.get({ scrimsGuild: { discord_id: interaction.guild.id } })
        const sortedPositionRoles = sortPositionRoles(interaction, positionRoles)
        const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles)
        return interaction.editReply({ 
            ...payload, content: `${role} is already connected to bridge scrims **${position.name}**!`, 
            allowedMentions: { parse: [] },
            ephemeral: true 
        });

    }

    if (existing.length > 0)
        return interaction.editReply(PositionsResponseMessageBuilder.positionRolesAddConfirmMessage(existing[0], role, position));

    await addPositionRole(interaction, role, position)
    
}

async function onConfirmComponent(interaction) {

    const roleId = interaction.args.shift()
    const role = interaction.guild.roles.resolve(roleId)
    if (!role) {

        return interaction.update(PositionsResponseMessageBuilder.errorMessage(`Invalid Role`, `Please pick a valid discord role and try again.`));

    }

    const position = await getPosition(interaction)
    if (!position) return false;
    
    await interaction.deferUpdate({ ephemeral: true })

    const success = await removePositionRoles(interaction, position, { scrimsGuild: { discord_id: interaction.guild.id }, role_id: roleId })
    if (!success) return false;

    await addPositionRole(interaction, role, position)

}

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

    if (interaction.options.getInteger("position") !== null) 
        return getPosition(interaction);
    return null;

}

async function onRemoveSubcommand(interaction) {

    const role = interaction.options.getRole("role")

    const position = await getOptionalPosition(interaction)
    if (position === false) return false;

    const positionFilter = position ? { id_position: position.id_position } : { };
    const selector = { scrimsGuild: { discord_id: interaction.guild.id }, role_id: role.id, ...positionFilter }
    
    const existing = await interaction.client.database.positionRoles.get(selector)
    if (existing.length === 0) {

        const message = `${role} is not connected to ${position ? `bridge scrims **${position.name}**!` : `any bridge scrims positions!`}`;
        return interaction.reply(PositionsResponseMessageBuilder.errorMessage(`Not Connected`, message));

    }

    await interaction.deferReply({ ephemeral: true })

    const success = await removePositionRoles(interaction, existing[0].position, selector)
    if (!success) return false;

    const positionRoles = interaction.client.database.positionRoles.cache.get({ scrimsGuild: { discord_id: interaction.guild.id } })
    const sortedPositionRoles = sortPositionRoles(interaction, positionRoles)
    const payload = PositionsResponseMessageBuilder.positionRolesStatusMessage(sortedPositionRoles)
    const message = `${role} was unconnected from ${position ? `bridge scrims **${position.name}**.` : `any bridge scrims positions.`}`
    await interaction.editReply({ ...payload, content: message, allowedMentions: { parse: [] }, ephemeral: true });

}

module.exports = onCommand;