const ScrimsMessageBuilder = require("../lib/responses");

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageButton } = require("discord.js");

const interactionHandlers = {

    "transfer-user-positions": onTransferPositionsCommand, 
    "TransferUserPositions": onTransferPositionsComponent,
    "create-position": onCreatePositionCommand,
    "remove-position": onRemovePositionCommand

}
async function onInteraction(interaction) {

    const interactionHandler = interactionHandlers[interaction.commandName]
    if (interactionHandler) return interactionHandler(interaction);

    await interaction.reply({ content: `How did we get here?`, ephemeral: true })

}

async function membersInitialized(interaction) {

    const members = await interaction.guild.members.fetch()
    const scrimsMembers = await Promise.all(members.map(member => interaction.client.database.users.get({ discord_id: member.id })))
    return (scrimsMembers.every(scrimsMembers => scrimsMembers.length > 0));

}

function getNonInitializedErrorPayload() {

    return ScrimsMessageBuilder.errorMessage(`Not Ready`, `This servers members have not yet all been added to the scrims user database. Please try again later.`);

}

async function onTransferPositionsCommand(interaction) {

    if (!(await membersInitialized(interaction))) return interaction.reply( getNonInitializedErrorPayload() );

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
            new MessageButton().setLabel("Cancel").setStyle(2).setCustomId(`TransferUserPositions/CANCEL`)  
        )

    await interaction.editReply({ content: message, components: [ actions ], ephemeral: true })

}


async function onTransferPositionsComponent(interaction) {

    if (interaction.args.shift() === "CANCEL") return interaction.update( { content: `Operation cancelled.`, embeds: [], components: [] } );

    if (!(await membersInitialized(interaction))) return interaction.update( getNonInitializedErrorPayload() );

    await interaction.update({ content: `Transfering...`, embeds: [], components: [] })

    const result = await interaction.client.syncHost.transferPositions(interaction.guild).catch(error => error)
    if (result instanceof Error) {

        console.error(`Transfer user positions failed!`, result)
        return interaction.editReply(ScrimsMessageBuilder.failedMessage(`transfer the user positions`));

    }

    await interaction.editReply({ content: `User positions successfully transfered!`, embeds: [], components: [], ephemeral: true })

}

async function onCreatePositionCommand(interaction) {



}

async function onPositionAutoComplete(interaction) {

    const focused = interaction.options.getFocused().toLowerCase()
    const positions = await interaction.client.database.positions.get({ }, false).catch(error => error)
    if (positions instanceof Error) {

        console.error(`Unable to get bridge scrims position because of ${positions}!`)
        return interaction.respond([]);

    }

    const relevantPositions = positions.filter(position => position.name.toLowerCase().includes(focused))
    await interaction.respond(relevantPositions.map(position => ({ name: position.name, value: position.id_position })))

}

async function onRemovePositionCommand(interaction) {

    if (interaction.isAutocomplete()) return onPositionAutoComplete(interaction); 

    const positionId = interaction.options.getInteger("position")
    const position = await interaction.client.database.positions.get({ id_position: positionId })
    if (position.length === 0)
        return interaction.reply(ScrimsMessageBuilder.errorMessage(`Invalid Position`, `Please choose a valid position and try again.`));

    const result = await interaction.client.database.positions.remove({ id_position: position[0].id_position }).catch(error => error)
    if (result instanceof Error)
        return interaction.reply(ScrimsMessageBuilder.failedMessage(`remove the **${position[0].name}** position`));

    await interaction.reply({ content: `Removed **${position[0].name}**.`, ephemeral: true })
    
}


function getTransferPositionsCommand() {

    const transferPositionsCommand = new SlashCommandBuilder()
        .setName("transfer-user-positions")
        .setDescription("Will add user positions based off their discord roles.")
    
    return [ transferPositionsCommand, { permissionLevel: "staff" } ];

}

function getCreatePositionCommand() {

    const createPositionCommand = new SlashCommandBuilder()
        .setName("create-position")
        .setDescription("Creates a bridge scrims position.")
        .addStringOption(option => option.setName("name").setDescription("The name of the new position."))
        .addBooleanOption(option => option.setName("sticky").setDescription("Whether the position should always stay."))
        .addIntegerOption(option => option.setName("level").setDescription("The level in the bridge scrims hierarchy."))
    
    return [ createPositionCommand, { permissionLevel: "owner" } ];

}

function getRemovePositionCommand() {

    const removePositionCommand = new SlashCommandBuilder()
        .setName("remove-position")
        .setDescription("Removes a bridge scrims position.")
        .addIntegerOption(option => option.setName("position").setDescription("The name of the position that should be removed.").setAutocomplete(true))
    
    return [ removePositionCommand, { permissionLevel: "owner" } ];

}

module.exports = {

    interactionHandler: onInteraction,
    commands: [ getTransferPositionsCommand(), getCreatePositionCommand(), getRemovePositionCommand() ],
    eventListeners: [ "TransferUserPositions" ]

}
