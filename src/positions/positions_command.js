const ScrimsUser = require("../lib/scrims/user");
const ScrimsUserPosition = require("../lib/scrims/user_position");
const PositionsResponseMessageBuilder = require("./responses");
const { default: parseDuration } = require("parse-duration");
const UserError = require("../lib/tools/user_error");

const subCmdHandlers = {

    "get": onGetSubcommand,
    "give": onGiveSubcommand,
    "take": onTakeSubcommand,
    "info": onInfoSubcommand

}

async function onCommand(interaction) {

    const subcommandHandler = subCmdHandlers[interaction.options.getSubcommand()]   
    if (subcommandHandler) return subcommandHandler(interaction);
        
    await interaction.reply({ content: "How did we get here?", ephemeral: true });

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onInfoSubcommand(interaction) {

    const positionId = interaction.options.getInteger("position")
    const userPositions = await interaction.client.database.userPositions.fetch({}, false)

    if (positionId) {

        const position = await getPosition(interaction)
        if (!position) return false

        const positionRole = await interaction.client.database.positionRoles.find({ id_position: position.id_position, guild_id: interaction?.guild?.id })
        await interaction.reply(PositionsResponseMessageBuilder.getPositionInfoMessage(position, positionRole, userPositions))
    
    }else {

        await interaction.reply(PositionsResponseMessageBuilder.getPositionsInfoMessage(interaction.client.database.positions.cache.values(), userPositions))
    
    }

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onGetSubcommand(interaction) {

    /** @type {ScrimsUser} */
    const scrimsUser = interaction.options.getMember('user')?.scrimsUser
    if (!scrimsUser) return interaction.reply(
        PositionsResponseMessageBuilder.unexpectedFailureMessage(interaction.i18n, interaction.i18n.get("not_scrims_guild_member"))
    )

    const userPositions = await scrimsUser.fetchPositions().then(v => v.getUserPositions())
    if (userPositions.length === 0) return interaction.reply( { content: `${scrimsUser} does not have any positions!`, allowedMentions: { parse: [] }, ephemeral: true } );
    await interaction.reply(PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, userPositions))

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function getPosition(interaction) {

    const positionId = interaction.options.getInteger("position")
    const position = interaction.client.database.positions.cache.resolve(positionId)
    if (!position) {

        return interaction.reply(
            PositionsResponseMessageBuilder.errorMessage(`Invalid Position`, `Please pick a valid bridge scrims position and try again!`)
        ).then(() => false);

    }
    return position;

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
function getExpiration(interaction) {

    const expiration = interaction.options.getString("expiration")
    if (expiration) {

        const duration = parseDuration(expiration)
        if (!duration || duration <= 0 || duration > (100*12*30*24*60*60*1000)) 
            throw new UserError("Invalid Expiration", "Please use a valid duration greater then 0 and not more then 100 years and try again.")

        return Math.floor((Date.now()+duration)/1000);

    }
    return null;

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onTakeSubcommand(interaction) {

    /** @type {ScrimsUser} */
    const scrimsUser = interaction.options.getMember('user')?.scrimsUser
    if (!scrimsUser) return interaction.reply(
        PositionsResponseMessageBuilder.unexpectedFailureMessage(interaction.i18n, interaction.i18n.get("not_scrims_guild_member"))
    )
    
    const position = await getPosition(interaction)
    if (!position) return false;

    if (!(await hasPositionPermissions(interaction, position, `take the \`${position.name}\` position from ${scrimsUser}`))) return false;

    const selector = { id_user: scrimsUser.id_user, id_position: position.id_position }
    const existing = await interaction.client.database.userPositions.find({ ...selector, show_expired: true })

    if (!existing) {

        return interaction.reply(
            PositionsResponseMessageBuilder.errorMessage(
                `Unkown User Position`, `The \`${position.name}\` position could not be taken, since ${scrimsUser} does not have it!`
            )
        );

    }

    const result = await interaction.client.database.userPositions.remove(selector).catch(error => error)
    if (result instanceof Error) {

        console.error(`Unable to remove a userPosition because of ${result}`, selector)
        return interaction.reply(PositionsResponseMessageBuilder.failedMessage(`remove ${scrimsUser}'s positions`));

    }

    const eventPayload = { guild_id: interaction?.guild?.id , executor_id: interaction.user.id, userPosition: existing }
    interaction.client.database.ipc.notify('audited_user_position_remove', eventPayload)

    const userPositions = await scrimsUser.fetchPositions().then(v => v.getUserPositions())
    const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, userPositions)
    await interaction.reply({ ...positionsMessage, content: `Removed **${position.name}** from ${scrimsUser}.`, allowedMentions: { parse: [] }, ephemeral: true })

}

async function hasPositionPermissions(interaction, position, action) {

    if (!(interaction.member.hasPermission("staff"))) {
        
        if (position.name !== "suggestion_blacklisted" && position.name !== "support_blacklisted") {

            return interaction.reply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(interaction.i18n, `You are not allowed to ${action}!`)
            ).then(() => false);

        }

    }

    if (typeof position.level === "number") {

        // For example if staff wants to add someone to owner position 
        if (!(interaction.member.hasPermission(position.name))) {

            return interaction.reply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(interaction.i18n, `You are not allowed to ${action}!`)
            ).then(() => false);

        } 
            
    }

    return true;

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onGiveSubcommand(interaction) {

    /** @type {ScrimsUser} */
    const scrimsUser = interaction.options.getMember('user')?.scrimsUser
    if (!scrimsUser) return interaction.reply(
        PositionsResponseMessageBuilder.unexpectedFailureMessage(interaction.i18n, interaction.i18n.get("not_scrims_guild_member"))
    )

    const position = await getPosition(interaction)
    if (!position) return false;

    const expires_at = getExpiration(interaction)

    if (!(await hasPositionPermissions(interaction, position, `give ${scrimsUser} the \`${position.name}\` position`))) return false;

    if (!(interaction.member.hasPermission("staff"))) {

        if (expires_at === null) {

            return interaction.reply(
                PositionsResponseMessageBuilder.missingPermissionsMessage(
                    interaction.i18n,
                    `You must be a staff member or higher to give someone a position without an expiration!`
                )
            );

        }

    }

    const usersPositions = await scrimsUser.fetchPositions(true)
    const existing = usersPositions.hasPosition(position)
    if (existing) {

        await interaction.client.database.userPositions.update(existing, { expires_at })

        const eventPayload = { guild_id: interaction?.guild?.id, executor_id: interaction.user.id, userPosition: existing, expires_at }
        interaction.client.database.ipc.notify('audited_user_position_expire_update', eventPayload)

        const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, usersPositions.getUserPositions()) 
        const content =  `${scrimsUser} **${position.name}** position will now last ${existing.getDuration()}.`
        return interaction.reply({ ...positionsMessage, content, allowedMentions: { parse: [] }, ephemeral: true });
        
    }

    const userPosition = new ScrimsUserPosition(interaction.database)
        .setUser(scrimsUser).setPosition(position).setExpirationPoint(expires_at)
        .setGivenPoint().setExecutor({ discord_id: interaction.user.id })
    
    const created = await interaction.client.database.userPositions.create(userPosition)
    const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, usersPositions.getUserPositions().concat(created))
    const content = `Added **${position.name}** to ${scrimsUser} ${created.getDuration()}.`
    await interaction.reply({ ...positionsMessage, content, allowedMentions: { parse: [] }, ephemeral: true })

}


module.exports = onCommand;