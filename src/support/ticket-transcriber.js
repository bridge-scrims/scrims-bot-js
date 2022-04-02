const { MessageEmbed, MessageAttachment } = require("discord.js");

class TicketTranscriber {

    constructor(transcriptTableClient) {

        this.client = transcriptTableClient // Instance of DBClient created in bot.js

    }
    
    async transcribe(ticketId, message) {

        await this.client.create({ 

            message_id: message.id, 
            id_ticket: ticketId, 
            content: message.content, 
            author: { discord_id: message.author.id },
            created_at: Math.round(message.createdTimestamp/1000)

        })

    }

    getHTMLContent(ticketMessages) {

        // Will make everything look pretty
        const style = (
            `body { margin: 20px; }`
            + `.table { width: auto; }`
            + `th { background: #A14F50; color: #FFFFFF }`
            + `td { white-space: nowrap; }`
            + `td.last { white-space: normal; width: 100%; }`
            + `h1 { color: #A14F50; margin-bottom: 16px; }`
        )

        // Adds all the data dynamically using the browsers timezone
        const script = (
            `$( document ).ready(() => onReady());`
            + `function onReady() {`
                + `const tableBody = $("#transcript-table-body");`
                + `const clientOptions = Intl.DateTimeFormat().resolvedOptions();`
                + `function getDate(timestamp) { return (new Date(timestamp)).toLocaleString(clientOptions.locale, { timeZone: clientOptions.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }) };`
                + `function getTime(timestamp) { return (new Date(timestamp)).toLocaleString(clientOptions.locale, { timeZone: clientOptions.timeZone, hour: "numeric", minute: "numeric" }) };`
                + ticketMessages.map(message => (
                    `tableBody.append(\``
                        + `<tr>`
                            + `<td>\${getDate(${message.created_at*1000})}</td>`
                            + `<td>\${getTime(${message.created_at*1000})}</td>`
                            + `<td>${message.author.discord_tag.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/`/g, "\\`")}</td>`
                            + `<td class="last">${message.content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/`/g, "\\`")}</td>`
                        + `</tr>`
                    + `\`);`
                )).join("")
            + `}`
        )

        // Includes bootstrap & jquery bcs noice
        const head = (
            `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous"><script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>`
            + `<script src="https://cdn.jsdelivr.net/npm/popper.js@1.12.9/dist/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>`
            + `<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>`
            + `<title>Bridge Scrims Ticket Transcript</title>`
            + `<script>${script}</script>`
            + `<style>${style}</style>`
        )

        // Mainly create a template to insert all the data into
        const body = (
            `<h1>Ticket Transcript</h1>`
            + `<table class="table table-striped">`
                + `<thead>`
                    + `<tr>`
                        + `<th scope="col">Date</th>`
                        + `<th scope="col">Time</th>`
                        + `<th scope="col">Author</th>`
                        + `<th scope="col">Message Content</th>`
                    + `</tr>`
                + `</thead>`
                + `<tbody id="transcript-table-body"></tbody>`
            + `</table>`
        )

        // Wrap everything together and return it
        return (
            `<!DOCTYPE html>`
                + `<html>`
                    + `<head>${head}</head>`
                    + `<body>${body}</body>`
                + `</html>`
        );

    }

    async send(guild, ticket) {
        
        try {

            const ticketTranscript = (await this.client.get({ id_ticket: ticket.id_ticket })).sort((a, b) => a.created_at - b.created_at)
            const transcriptContent = this.getHTMLContent(ticketTranscript)

            const buff = Buffer.from(transcriptContent, "utf-8");
            const file = new MessageAttachment(buff, `Bridge_Scrims_Support_Transcript_${ticket.id_ticket}.html`);

            await this.client.remove({ id_ticket: ticket.id_ticket })
            
            const embed = new MessageEmbed()
                .setColor("#FFFFFF")
                .setTitle(`Support Ticket Transcript`)
                .setDescription(`Ticket created by <@${ticket.user.discord_id}>`)
                .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
                .setTimestamp(ticket.created_at*1000)
    
            const channel = guild.client.support.transcriptChannel
            if (channel) await channel.send({ embeds: [embed], files: [file] });
            
            const user = await guild.client.users.fetch(ticket.user.discord_id)
                .catch(error => this.onUserDMMissed(channel, ticket.user.discord_id, `${error}`).then(() => null))
            
            if (user !== null) 
                await user.send({ embeds: [embed], files: [file] }).catch(error => this.onUserDMMissed(channel, ticket.user.discord_id, `${error}`));

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