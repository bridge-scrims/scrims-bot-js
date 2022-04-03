const PositionsResponseMessageBuilder = require("./responses");

const subCmdHandlers = {

    "get": onGetSubcommand,
    "give": onGiveSubcommand,
    "take": onTakeSubcommand

}

async function onCommand(interaction) {

    const subcommandHandler = subCmdHandlers[interaction.options.getSubcommand()]   
    if (subcommandHandler) return subcommandHandler(interaction);
        
    await interaction.reply({ content: "How did we get here?", ephemeral: true });

}

function sortUserPositions(userPositions) {

    return userPositions.sort((a, b) => a.id_position - b.id_position);

}

async function onGetSubcommand(interaction) {

    const user = interaction.options.getUser('user')

    const userPositions = await interaction.client.database.userPositions.get({ user: { discord_id: user.id } })

    if (userPositions.length === 0) return interaction.reply( { content: `${user} does not have any positions!`, allowedMentions: { parse: [] }, ephemeral: true } );

    await interaction.reply( PositionsResponseMessageBuilder.getUserPositionsMessage(user, sortUserPositions(userPositions)) )

}

async function getPosition(interaction) {

    const positionId = interaction.options.getInteger("position")
    const position = interaction.client.database.positions.cache.get({ id_position: positionId })[0]
    if (!position) {

        return interaction.reply(
            PositionsResponseMessageBuilder.errorMessage(`Invalid Position`, `Please pick a valid bridge scrims position and try again!`)
        ).then(() => false);

    }
    return position;

}

async function getExpiration(interaction) {

    const expiration = interaction.options.getInteger("expiration")
    if (typeof expiration === "number") {

        if (expiration < 0 || expiration > 8760) {

            return interaction.reply(
                PositionsResponseMessageBuilder.errorMessage(`Invalid Expiration`, `The expiration must be a number between 0-8760!`)
            ).then(() => false);

        }  
        return ( Math.round((Date.now()/1000) + (expiration*60*60)) );

    }
    return null;

}

async function onTakeSubcommand(interaction) {

    const user = interaction.options.getUser("user")
    
    const position = await getPosition(interaction)
    if (!position) return false;

    if (!(await hasPositionPermissions(interaction, position, `take the \`${position.name}\` position from ${user}`))) return false;

    const selector = { user: { discord_id: user.id }, id_position: position.id_position }
    const existing = await interaction.client.database.userPositions.get(selector)

    if (existing.length === 0) {

        return interaction.reply(
            PositionsResponseMessageBuilder.errorMessage(
                `Unkown User Position`, `The \`${position.name}\` position could not be taken, since ${user} does not have it!`
            )
        );

    }

    const result = await interaction.client.database.userPositions.remove(selector).catch(error => error)
    if (result instanceof Error) {

        console.error(`Unable to remove a userPosition because of ${result}`, selector)
        return interaction.reply( PositionsResponseMessageBuilder.failedMessage(`remove ${user}'s positions`) );

    }

    const userPositions = interaction.client.database.userPositions.cache.get({ user: { discord_id: user.id } })
    const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(user, sortUserPositions(userPositions))

    await interaction.reply({ ...positionsMessage, content: `Removed **${position.name}** from ${user}.`, allowedMentions: { parse: [] }, ephemeral: true })

}

async function hasPositionPermissions(interaction, position, action) {

    if (!(await interaction.member.hasPermission("staff"))) {
        
        if (position.name != "suggestion_blacklisted" && position.name != "support_blacklisted") {

            return interaction.reply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(`You are not allowed to ${action}!`)
            ).then(() => false);

        }

    }

    if (typeof position.level === "number") {

        // For example if staff wants to add someone to owner position 
        if (!(await interaction.client.permissions.hasPermissionLevel(interaction.member, position.name))) {

            return interaction.reply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(`You are not allowed to ${action}!`)
            ).then(() => false);

        } 
            
    }

    return true;

}

async function onGiveSubcommand(interaction) {

    const user = interaction.options.getUser("user")

    const position = await getPosition(interaction)
    if (!position) return false;

    const expires_at = await getExpiration(interaction)
    if (expires_at === false) return false;

    if (!(await interaction.member.hasPermission("staff"))) {

        if (expires_at === null) {

            return interaction.reply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(
                    `You must be a staff member or higher to give someone a position without an expiration!`
                )
            );

        }

    }

    if (!(await hasPositionPermissions(interaction, position, `give ${user} the \`${position.name}\` position`))) return false;

    const selector = { user: { discord_id: user.id }, id_position: position.id_position }
    const existing = await interaction.client.database.userPositions.get(selector)
    if (existing.length > 0) {

        if (expires_at) {

            await interaction.client.database.userPositions.update(selector, { expires_at })
            return interaction.reply({ content: `Expiration updated! ${user} **${position.name}** position will now expire <t:${expires_at}:R>.`, allowedMentions: { parse: [] }, ephemeral: true });

        }

        await interaction.client.database.userPositions.update(selector, { expires_at: null })
        return interaction.reply({ content: `Expiration updated! ${user} **${position.name}** position is now permanent.`, allowedMentions: { parse: [] }, ephemeral: true });
        
    }

    if (!interaction.scrimsUser) {

        return interaction.reply( PositionsResponseMessageBuilder.scrimsUserNeededMessage() );

    }

    const userPosition = { ...selector, expires_at, given_at: Math.round((Date.now()/1000)), id_executor: interaction.scrimsUser.id_user }
    await interaction.client.database.userPositions.create(userPosition)

    const userPositions = interaction.client.database.userPositions.cache.get({ user: { discord_id: user.id } })
    const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(user, sortUserPositions(userPositions))
    const expirationMessage = expires_at ? `until <t:${expires_at}:F>` : "permanently"; 

    await interaction.reply({ ...positionsMessage, content: `Added **${position.name}** to ${user} ${expirationMessage}.`, allowedMentions: { parse: [] }, ephemeral: true })

}


module.exports = onCommand;