const ScrimsMessageBuilder = require("../lib/responses");

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageButton } = require("discord.js");

const interactionHandlers = {

    "transfer-user-positions": onTransferPositionsCommand, 
    "TransferUserPositions": onTransferPositionsComponent 

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


function getTransferPositionsCommand() {

    const transferPositionsCommand = new SlashCommandBuilder()
        .setName("transfer-user-positions")
        .setDescription("Will add user positions based off their discord roles.")
    
    return [ transferPositionsCommand, { permissionLevel: "staff" } ];

}

module.exports = {

    interactionHandler: onInteraction,
    commands: [ getTransferPositionsCommand() ],
    eventListeners: [ "TransferUserPositions" ]

}
