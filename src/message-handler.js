const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

function expandMessage(message) {
    message.user = message.author
    message.userId = message.author.id
    message.hasPermission = (permLevel) => message.client.hasPermission(message?.member, permLevel)
}

async function handleMessage(message) {
    expandMessage(message);

    const dbClient = message.client.database; // Instance of DBClient created in bot.js
    const ticket = dbClient.cache.getTicket({ channelId: message.channel.id })
    
    if (ticket && (message.author.id != message.client.user.id)) {
        const transcriber = message.client.transcriber; // Instance of TicketTranscriber created in bot.js
        await transcriber.transcribe(ticket.id, message).catch(console.error);
        return true;
    } 
    
    if (message.content === `${message.client.prefix}ticketembed` && message.hasPermission("SUPPORT")) {
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
        return true;
    }
    
    return false;
    
}

module.exports = handleMessage;