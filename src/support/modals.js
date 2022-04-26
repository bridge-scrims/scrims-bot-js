const { MessageEmbed, MessageActionRow } = require("discord.js");
const MemoryMessageButton = require("../lib/memory_button");
const ScrimsMessageBuilder = require("../lib/responses");

function getReasonText(text) {

    
    
}

async function getTargets(interaction) {

    return [];
    const targets = interaction.getTextInputValue('targets')
    
    const userTags = targets.split(' ')

    

}

async function onSubmit(interaction) {

    const ticketData = {}

    if (!interaction.guild) return interaction.reply(ScrimsMessageBuilder.guildOnlyMessage());
    
    ticketData.type = interaction.args.shift()

    const inputValue = interaction.getTextInputValue('request-reason')
    if (typeof inputValue !== 'string') return interaction.editReply(ScrimsMessageBuilder.errorMessage('Invalid Reason', "You reason must contain at least 15 letters to be valid."));
    
    ticketData.reason = getReasonText(inputValue)

    await interaction.deferReply({ ephemeral: true })
    
    const allowed = await interaction.client.support.verifyTicketRequest(interaction, ticketData.type)
    if (allowed !== true) return interaction.editReply(allowed);

    ticketData.targets = await getTargets(interaction)

    const actions = new MessageActionRow()
        .addComponents(
            new MemoryMessageButton(interaction.client, ticketData).setCustomId('supportTickets/CREATE').setLabel('Create').setStyle('SUCCESS'),
            new MemoryMessageButton(interaction.client, ticketData).setCustomId('supportTickets/REOPEN').setLabel('Edit').setStyle('PRIMARY'),
            ScrimsMessageBuilder.cancelButton()
        )

    await interaction.editReply({ 
        ...(await interaction.client.support.getTicketInfoPayload(interaction.member, [], ticketData)), content: `**This is just a preview of what the support team will see.**`, 
        components: [ actions ], ephemeral: true 
    })

}

module.exports = onSubmit;