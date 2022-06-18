const ScrimsMessageBuilder = require("../lib/responses");

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageButton } = require("discord.js");

const interactionHandlers = {

    "transfer-user-positions": onTransferPositionsCommand, 
    "TransferUserPositions": onTransferPositionsComponent,
    "create-position": onCreatePositionCommand,
    "remove-position": onRemovePositionCommand,
    "update-position": onUpdatePositionCommand

}
async function onInteraction(interaction) {

    const interactionHandler = interactionHandlers[interaction.commandName]
    if (interactionHandler) return interactionHandler(interaction);

    throw new Error(`Interaction with name '${interaction.commandName}' does not have a handler!`, interactionHandlers);

}


async function onTransferPositionsCommand(interaction) {

    if (interaction.guild.id !== interaction.client.syncHost.hostGuildId) 
        return interaction.reply({ content: "This command can only be used in the host guild!", ephemeral: true });

    await interaction.deferReply({ ephemeral: true })

    const memberChanges = await interaction.client.syncHost.getMembersPositionsDifference(interaction.guild).catch(error => error)
    if (memberChanges instanceof Error) {

        console.error(`Unable to get member user positions differences!`, memberChanges)
        return interaction.editReply(ScrimsMessageBuilder.errorMessage("Command Failed", `Unable to get member user position differences. Please try again later.`));

    }

    const wrongUserPositions = memberChanges.map(([ _, v ]) => v).flat().length
    const newPositions = memberChanges.map(([ v, _ ]) => v).flat().length

    const message = `Are you sure you want to do this? This will remove **${wrongUserPositions}**\`incorrect user positions\``
        + ` from the scrims database and add **${newPositions}**\`new user positions\`!`

    const actions = new MessageActionRow()
        .addComponents( 
            new MessageButton().setLabel("Confirm").setStyle(3).setCustomId(`TransferUserPositions/CONFIRM`),
            ScrimsMessageBuilder.cancelButton(interaction.i18n)
        )

    await interaction.editReply({ content: message, components: [ actions ], ephemeral: true })

}


async function onTransferPositionsComponent(interaction) {

    if (interaction.args.shift() === "CANCEL") return interaction.update( { content: `Operation cancelled.`, embeds: [], components: [] } );

    if (!interaction.scrimsUser) return interaction.reply(ScrimsMessageBuilder.scrimsUserNeededMessage());

    await interaction.deferUpdate()
    await interaction.editReply({ content: `Transfering...`, embeds: [], components: [] })

    const result = await interaction.client.syncHost.transferPositions(interaction.guild, interaction.scrimsUser.id_user).catch(error => error)
    if (result instanceof Error) {

        console.error(`Transfer user positions failed!`, result)
        return interaction.editReply(ScrimsMessageBuilder.failedMessage(`transfer the user positions`));

    }

    const [ removed, added ] = result
    
    const content = `**${removed.filter(v => v === true).length}/${removed.length}** \`removed\` successfully and `
        + `**${added.filter(v => v === true).length}/${added.length}** \`added\` successfully`

    await interaction.editReply({ content, embeds: [], components: [], ephemeral: true })
        .catch(() => {/* This could take more then 15 minutes, making the interaction token expire. */})

}

async function onCreatePositionCommand(interaction) {

    const name = interaction.options.getString("name")
    const sticky = interaction.options.getBoolean("sticky") ?? false
    const level = interaction.options.getInteger("level") ?? null

    if (level !== null && level <= 0) 
        return interaction.editReply(ScrimsMessageBuilder.errorMessage("Invalid Level", "The position level must be a number greater then 0!"));
    const position = await interaction.client.database.positions.create({ name, sticky, level }).catch(console.error)
    if (!position) return interaction.editReply(ScrimsMessageBuilder.failedMessage('create the position'));

    interaction.client.database.ipc.send('audited_position_create', { position, id_executor: interaction.scrimsUser.id_user })
    await interaction.editReply({ content: `Created **${position.name}**.`, ephemeral: true })

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function onUpdatePositionCommand(interaction) {

    if (interaction.isAutocomplete()) return onPositionAutoComplete(interaction); 

    const id_position = interaction.options.getInteger("position")
    const position = interaction.client.database.positions.cache.resolve(id_position)
    if (!position) return interaction.reply(ScrimsMessageBuilder.errorMessage(`Invalid Position`, `Please choose a valid position and try again.`));

    const name = interaction.options.getString("name")
    const sticky = interaction.options.getBoolean("sticky")
    const level = interaction.options.getInteger("level")

    if (level !== null && level <= 0) 
        return interaction.editReply(ScrimsMessageBuilder.errorMessage("Invalid Level", "The position level must be a number greater then 0!"));
        
    if (name !== null && interaction.database.positions.cache.find({ name }))
        return interaction.editReply(ScrimsMessageBuilder.errorMessage("Invalid Name", "A position already exists with this name!"));

    const update = {}
    if (name !== null && position.name !== name) update["name"] = name
    if (sticky !== null && position.sticky !== sticky) update["sticky"] = sticky
    if (level !== null && position.level !== level) update["level"] = level
    
    if (Object.keys(update).length === 0) 
        return interaction.editReply(ScrimsMessageBuilder.errorMessage("Invalid Parameters", "There is nothing to update here!"));

    await interaction.database.positions.update(position, update)
    await interaction.editReply({ content: "Position updated." })

}

async function onPositionAutoComplete(interaction) {

    const focused = interaction.options.getFocused().toLowerCase()
    const positions = interaction.client.database.positions.cache.values()

    const relevantPositions = positions.filter(position => position.name.toLowerCase().includes(focused))
    await interaction.respond(relevantPositions.map(position => ({ name: position.name, value: position.id_position })))

}

/**
 * @param {import('../types').ScrimsCommandInteraction} interaction 
 */
async function onRemovePositionCommand(interaction) {

    if (interaction.isAutocomplete()) return onPositionAutoComplete(interaction); 

    const id_position = interaction.options.getInteger("position")
    const position = interaction.client.database.positions.cache.resolve(id_position)
    if (!position) return interaction.reply(ScrimsMessageBuilder.errorMessage(`Invalid Position`, `Please choose a valid position and try again.`));

    const removed = await interaction.client.database.positionRoles.remove({ id_position })
    removed.forEach(selector => interaction.client.database.ipc.notify('audited_position_role_remove', { executor_id: interaction.user.id, selector }))

    const existing = await interaction.client.database.userPositions.fetch({ id_position }, false)
    await interaction.client.database.userPositions.remove({ id_position })
    existing.forEach(userPosition => interaction.client.database.ipc.notify("audited_user_position_remove", { executor_id: interaction.user.id, userPosition }))

    const result = await interaction.client.database.positions.remove({ id_position }).catch(error => error)
    if (result instanceof Error) {
        console.error(result)
        return interaction.editReply(ScrimsMessageBuilder.failedMessage(`remove the **${position.name}** position`));
    }
       
    interaction.client.database.ipc.send('audited_position_remove', { position, id_executor: interaction.scrimsUser.id_user })
    await interaction.editReply({ content: `Removed **${position.name}**.`, ephemeral: true })
    
}


function getTransferPositionsCommand() {

    const transferPositionsCommand = new SlashCommandBuilder()
        .setName("transfer-user-positions")
        .setDescription("Will add user positions based off their discord roles.")
    
    return [ transferPositionsCommand, { permissionLevel: "staff" }, { forceGuild: true, bypassBlock: false, forceScrimsUser: false } ];

}

function getCreatePositionCommand() {

    const createPositionCommand = new SlashCommandBuilder()
        .setName("create-position")
        .setDescription("Creates a bridge scrims position.")
        .addStringOption(option => option.setName("name").setDescription("The name of the new position.").setRequired(true))
        .addBooleanOption(option => option.setName("sticky").setDescription("Whether the position should always stay."))
        .addIntegerOption(option => option.setName("level").setDescription("The level in the bridge scrims hierarchy."))
    
    return [ createPositionCommand, { permissionLevel: "owner" }, { forceGuild: true, bypassBlock: false, forceScrimsUser: true, ephemeralDefer: true } ];

}

function getRemovePositionCommand() {

    const removePositionCommand = new SlashCommandBuilder()
        .setName("remove-position")
        .setDescription("Removes a bridge scrims position.")
        .addIntegerOption(option => option.setName("position").setDescription("The name of the position that should be removed.").setRequired(true).setAutocomplete(true))
    
    return [ removePositionCommand, { permissionLevel: "owner" }, { forceGuild: true, bypassBlock: false, forceScrimsUser: true, ephemeralDefer: true } ];

}

function getUpdatePositionCommand() {

    const updatePositionCommand = new SlashCommandBuilder()
        .setName("update-position")
        .setDescription("Updates a bridge scrims position.")
        .addIntegerOption(option => option.setName("position").setDescription("The name of the position that should be edited.").setRequired(true).setAutocomplete(true))
        .addStringOption(option => option.setName("name").setDescription("The new name of this position.").setRequired(false))
        .addBooleanOption(option => option.setName("sticky").setDescription("Whether the position should always stay.").setRequired(false))
        .addIntegerOption(option => option.setName("level").setDescription("The new level in the bridge scrims hierarchy.").setRequired(false))
    
    return [ updatePositionCommand, { permissionLevel: "owner" }, { forceGuild: true, bypassBlock: false, forceScrimsUser: true, ephemeralDefer: true } ];

}

module.exports = {

    interactionHandler: onInteraction,
    commands: [getTransferPositionsCommand(), getCreatePositionCommand(), getRemovePositionCommand(), getUpdatePositionCommand()],
    eventListeners: [ "TransferUserPositions" ]

}
