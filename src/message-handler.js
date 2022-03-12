const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const ResponseTemplates = require("./response-templates");

function expandMessage(message) {
    message.user = message.author
    message.userId = message.author.id
    message.hasPermission = (permLevel) => message.client.hasPermission(message?.member, permLevel)
}

async function handleMessage(message) {
    expandMessage(message);

    if (message.channelId == message.client.suggestionsChannelId) return onSuggestionChannelMessage(message);

    if (message.type !== 'DEFAULT') return false;
    if (message.author.bot) return false;

    const dbClient = message.client.database; // Instance of DBClient created in bot.js
    const ticket = dbClient.cache.getTicket({ channelId: message.channel.id })
    
    if (ticket && (message.author.id != message.client.user.id)) {
        const transcriber = message.client.transcriber; // Instance of TicketTranscriber created in bot.js
        await transcriber.transcribe(ticket.id, message).catch(console.error);
        return true;
    } 
    
    if (message.content === `${message.client.prefix}ticketembed` && message.hasPermission("SUPPORT"))
        return createSupportMessage(message);
    
    return false;
    
}

async function createSupportMessage(message) {
    const action = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId("support")
                .setLabel("✉️ Support")
                .setStyle("PRIMARY")
        );

    const embed = new MessageEmbed()
        .setColor("#5d9acf")
        .setTitle("Bridge Scrims Support")
        .setDescription("If you do not state your issue within 5 minutes of creating your ticket, it will be closed.")
        .setTimestamp();

    await message.delete().catch(console.error)
    await message.channel.send({ embeds: [embed], components: [action] }).catch(console.error)
}


async function onSuggestionChannelMessage(message) { 

    // Messages like CHANNEL_PINNED_MESSAGE & THREAD_CREATED should get deleted
    const badMessageTypes = ['CHANNEL_PINNED_MESSAGE', 'THREAD_STARTER_MESSAGE']
    if (badMessageTypes.includes(message.type)) return message.delete().catch(console.error);

    // Bot sent the message so don't worry about it
    if (message.author.id == message.client.user.id) return false;

    // Recreate the suggestions info message so that it is displayed at the bottom of the channel
    await message.client.sendSuggestionInfoMessage(message.channel, false)

}


module.exports = handleMessage;