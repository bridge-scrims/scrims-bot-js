const { MessageEmbed, MessageAttachment } = require("discord.js");
const fs = require("fs/promises");

class TicketTranscriber {

    constructor(dbClient) {
        this.client = dbClient // Instance of DBClient created in bot.js
    }
    
    async transcribe(ticketId, message) {

        await this.client.createTranscriptMessage(message, ticketId)

    }

    getHTMLContent(ticketTranscript) {

        return (
            `<!DOCTYPE html>`
                + `<html>`
                    + `<head>`
                        + `<link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=PT Sans" />`
                        + `<link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=Ubuntu" />`
                        + `<title>Ranked Bridge Ticket Transcript</title>`
                        + `<style> </style>`
                    + `</head>`
                    + `<body>`
                        + `<h1>Ticket Transcript</h1>`
                        + `${ticketTranscript.map(s => `<p>${s}</p>`).join("\n")}`
                    + `</body>`
                + `</html>`
        );

    }

    async send(guild, ticket) {
        
        try {
            const ticketTranscript = (await this.client.getTranscript(ticket.id)).map(message => `<b>${message.authorTag}:</b> ${message.content}`)

            const filePath = `./tickets/${ticket.id}.html`
            await fs.writeFile(filePath, this.getHTMLContent(ticketTranscript), { flags: "a" });
            await this.client.removeTranscript(ticket.id)
            const file = new MessageAttachment(filePath);

            const embed = new MessageEmbed()
                .setColor("#2F3136")
                .setTitle(`Transcript for <#${ticket.channelId}>`)
                .setDescription(`Created by <@${ticket.userId}>`)
                .setTimestamp()
    
            const channel = guild.client.transcriptChannel
            if (channel) await channel.send({ embeds: [embed], files: [file] });
            
            const user = await guild.client.users.fetch(ticket.userId)
                .catch(error => this.onUserDMMissed(channel, ticket.userId, `${error}`).then(() => null))
            
            if (user !== null) 
                await user.send({ embeds: [embed], files: [file] }).catch(error => this.onUserDMMissed(channel, ticket.userId, `${error}`));
        }catch(error) {
            console.error(error)
        }

    }

    async onUserDMMissed(channel, userId, reason) {

        if (!channel) return false;
        return channel.send(`Couldn't DM <@${userId}> because of \`${reason}\`!`);
        
    }

}

module.exports = TicketTranscriber;