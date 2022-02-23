const { MessageEmbed } = require("discord.js");
const util = require("util");
const fs = require("fs");


class TicketTranscriber {
    
    transcribe(id, message) {

        const logFile = fs.createWriteStream(`../tickets/${id}.txt`, { flags: "a" });
        if (!message) logFile.write(util.format("Could not get message.") + "\n");
        else logFile.write(util.format(message) + "\n");

    }

    readTranscript(id) {

        const content = fs.readFileSync(`../tickets/${id}.txt`, 'utf8');
        return content.split("\n");

    }

    getHTMLContent(ticketTranscript) {

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=PT Sans" />
                    <link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=Ubuntu" />
                    <title>Ranked Bridge Ticket Transcript</title>
                    <style> </style>
                </head>
                <body>
                    <h1>Ticket Transcript</h1>
                    ${ticketTranscript.map(s => `<p>${s}</p>`).join("\n")}
                </body>
            </html>
        `;

    }

    async send(guild, ticket) {
        
        try {
            const ticketTranscript = this.readTranscript(ticket.id)
            const logFile = fs.createWriteStream(`../tickets/${id}.html`, { flags: "a" });
            logFile.write(this.getHTMLContent(ticketTranscript));
    
            const file = new MessageAttachment(`../tickets/${id}.html`);
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