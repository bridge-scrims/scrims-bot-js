
function auditEvents(bot) {

    bot.on("messageDelete", message => onMessageDelete(message))
    bot.on("channelDelete", channel => onChannelDelete(channel))
    bot.on("channelCreate", channel => onChannelCreate(channel))

}

async function onMessageDelete(message) {

    if (message.guild) {

        const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: 'MESSAGE_DELETE' })
            .catch(error => console.error(`Unable to fetch audit logs after messasge delete because of ${error}!`))

        if (fetchedLogs.entries.size > 0) {

            const deletionLog = fetchedLogs.entries.first()
            if (message.partial || deletionLog.target.id == message.author.id) {

                if (deletionLog.extra.channel.id == message.channelId) {

                    message.executor = deletionLog.executor;
    
                }

            }

        }
        
    }

    await message.client.onInteractEvent(message, 'MessageDelete', true)

}

async function onChannelDelete(channel) {

    if (channel.guild) {

        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: 'CHANNEL_DELETE' })
            .catch(error => console.error(`Unable to fetch audit logs after channel delete because of ${error}!`))

        if (fetchedLogs.entries.size > 0) {

            const deletionLog = fetchedLogs.entries.first()
            if (deletionLog.target.id == channel.id) {

                channel.executor = deletionLog.executor;

            }

        }
        
    }

    await channel.client.onInteractEvent(channel, 'ChannelDelete', true)

}

async function onChannelCreate(channel) {

    if (channel.guild) {

        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: 'CHANNEL_CREATE' })
            .catch(error => console.error(`Unable to fetch audit logs after channel create because of ${error}!`))

        if (fetchedLogs.entries.size > 0) {

            const creationLog = fetchedLogs.entries.first()
            if (creationLog.target.id == channel.id) {

                channel.executor = creationLog.executor;

            }

        }
        
    }

    await channel.client.onInteractEvent(channel, 'ChannelCreate', true)

}

module.exports = auditEvents;