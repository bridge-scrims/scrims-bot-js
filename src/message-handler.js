const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

async function handleMessage(message) {

    const dbClient = message.client.database; // Instance of DBClient created in bot.js
    const ticket = dbClient.cache.getTicket({ channelId: message.channel.id })
    
    if (ticket && (message.author.id != message.client.user.id)) {
        const transcriber = interaction.client.transcriber; // Instance of TicketTranscriber created in bot.js
        transcriber.transcribe(message.channel.id, `<b>${message.author.username}:</b> ${message.content}`);
        return true;
    } 
    
    if (message.content === `${message.client.prefix}ticketembed` && message.fromSupport) {
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
        
        message.channel.send({ embeds: [embed], components: [action] });
        return true;
    }
    
    return false;
    
}

module.exports = handleMessage;