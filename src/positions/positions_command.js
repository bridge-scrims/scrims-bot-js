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
        const position = getPosition(interaction)
        const positionRole = (interaction.guild ? (await interaction.client.database.positionRoles.find({ id_position: position.id_position, guild_id: interaction.guild.id })) : null)
        await interaction.reply(PositionsResponseMessageBuilder.getPositionInfoMessage(position, positionRole, userPositions))
    }else {
        await interaction.reply(PositionsResponseMessageBuilder.getPositionsInfoMessage(interaction.client.database.positions.cache.values(), userPositions))
    }

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onGetSubcommand(interaction) {

    /** @type {ScrimsUser} */
    const scrimsUser = interaction.options.getUser('user')?.scrimsUser ?? (await interaction.database.users.find({ discord_id: interaction.options.get("user").value }))
    if (!scrimsUser) return interaction.reply(
        PositionsResponseMessageBuilder.unexpectedFailureMessage(interaction.i18n, interaction.i18n.get("not_scrims_guild_member"))
    )

    const userPositions = await scrimsUser.fetchPositions().then(v => v.getUserPositions())
    if (userPositions.length === 0) return interaction.reply({ content: `${scrimsUser} does not have any positions!`, allowedMentions: { parse: [] }, ephemeral: true });
    await interaction.reply(PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, userPositions, interaction.guild))

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
function getPosition(interaction) {

    const positionId = interaction.options.getInteger("position")
    const position = interaction.client.database.positions.cache.resolve(positionId)
    if (!position) throw new UserError(`Invalid Position`, `Please pick a valid bridge scrims position and try again!`);
    return position;

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
function getExpiration(interaction) {

    const expiration = interaction.options.getString("expiration")
    if (expiration) {

        const duration = parseDuration(expiration)
        if (!duration || duration < (1000*60) || duration > (100*12*30*24*60*60*1000)) 
            throw new UserError("Invalid Expiration", "Please use a valid duration between 1 minute and 100 years and try again.")

        return Math.floor((Date.now()+ duration)/1000);

    }
    return null;

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onTakeSubcommand(interaction) {

    /** @type {ScrimsUser} */
    const scrimsUser = interaction.options.getUser('user')?.scrimsUser ?? (await interaction.database.users.find({ discord_id: interaction.options.get("user").value }))
    if (!scrimsUser) return interaction.reply(
        PositionsResponseMessageBuilder.unexpectedFailureMessage(interaction.i18n, interaction.i18n.get("not_scrims_guild_member"))
    )
    
    const position = getPosition(interaction)
    verifyPositionPermissions(interaction, position, `take the \`${position.name}\` position from ${scrimsUser}`)

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

    const eventPayload = { executor_id: interaction.user.id, userPosition: existing }
    interaction.client.database.ipc.notify('audited_user_position_remove', eventPayload)

    const userPositions = await scrimsUser.fetchPositions().then(v => v.getUserPositions())
    const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, userPositions, interaction.guild)
    await interaction.reply({ ...positionsMessage, content: `Removed **${position.name}** from ${scrimsUser}.`, allowedMentions: { parse: [] }, ephemeral: false })

}

function verifyPositionPermissions(interaction, position, action) {

    if (!(interaction.scrimsPositions.hasPositionLevel("staff")))
        if (!position.name.includes("blacklisted"))
            throw new UserError(PositionsResponseMessageBuilder.missingPermissionsMessage(interaction.i18n, `You are not allowed to ${action}!`))

    if (typeof position.level === "number") {
        // For example if staff wants to add someone to owner position 
        if (!(interaction.scrimsPositions.hasPositionLevel(position)))
            throw new UserError(PositionsResponseMessageBuilder.missingPermissionsMessage(interaction.i18n, `You are not allowed to ${action}!`));
    }

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onGiveSubcommand(interaction) {

    /** @type {ScrimsUser} */
    const scrimsUser = interaction.options.getUser('user')?.scrimsUser ?? (await interaction.database.users.find({ discord_id: interaction.options.get("user").value }))
    if (!scrimsUser) return interaction.reply(
        PositionsResponseMessageBuilder.unexpectedFailureMessage(interaction.i18n, interaction.i18n.get("not_scrims_guild_member"))
    )

    const position = getPosition(interaction)
    const expires_at = getExpiration(interaction)

    verifyPositionPermissions(interaction, position, `give ${scrimsUser} the \`${position.name}\` position`)

    const usersPositions = await scrimsUser.fetchPositions(true)
    const existing = usersPositions.hasPosition(position)
    if (existing) {

        await interaction.client.database.userPositions.update(existing, { expires_at })

        const eventPayload = { executor_id: interaction.user.id, userPosition: existing, expires_at }
        interaction.client.database.ipc.notify('audited_user_position_expire_update', eventPayload)

        const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, usersPositions.getUserPositions(), interaction.guild) 
        const content = `${scrimsUser} **${position.name}** position will now last ${existing.getDuration()}.`
        return interaction.reply({ ...positionsMessage, content, allowedMentions: { parse: [] }, ephemeral: false });
        
    }

    const userPosition = new ScrimsUserPosition(interaction.database)
        .setUser(scrimsUser).setPosition(position).setExpirationPoint(expires_at)
        .setGivenPoint().setExecutor({ discord_id: interaction.user.id })
    
    const created = await interaction.client.database.userPositions.create(userPosition)
    const positionsMessage = PositionsResponseMessageBuilder.getUserPositionsMessage(scrimsUser, usersPositions.getUserPositions().concat(created), interaction.guild)
    const content = `Added **${position.name}** to ${scrimsUser} ${created.getDuration()}.`
    await interaction.reply({ ...positionsMessage, content, allowedMentions: { parse: [] }, ephemeral: false })

}


module.exports = onCommand;