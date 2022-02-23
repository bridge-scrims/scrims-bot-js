const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

function expandMessage(message) {
    message.userId = message.author.id
    message.fromSupport = message.client.supportRoles.some(roleId => message?.member?.roles?.cache?.has(roleId))
    message.fromStaff = message.client.staffRoles.some(roleId => message?.member?.roles?.cache?.has(roleId))
}

async function handleMessage(message) {
    expandMessage(message);

    const dbClient = message.client.database; // Instance of DBClient created in bot.js
    const ticket = dbClient.cache.getTicket({ channelId: message.channel.id })
    
    if (ticket && (message.author.id != message.client.user.id)) {
        const transcriber = message.client.transcriber; // Instance of TicketTranscriber created in bot.js
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