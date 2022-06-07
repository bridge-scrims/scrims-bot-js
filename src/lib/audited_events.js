
function auditEvents(bot) {

    bot.on("messageDelete", message => onMessageDelete(message).catch(console.error))
    bot.on("channelDelete", channel => onChannelDelete(channel).catch(console.error))
    bot.on("channelCreate", channel => onChannelCreate(channel).catch(console.error))
    bot.on("guildMemberUpdate", (oldMember, newMember) => onMemberUpdate(oldMember, newMember).catch(console.error))
    bot.on('scrimsMemberUpdate', ({ oldMember, newMember, executor }) => onScrimsMemberUpdate(oldMember, newMember, executor).catch(console.error))

}

async function onMessageDelete(message) {

    if (message.guild) {

        const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: 'MESSAGE_DELETE' })
            .catch(error => console.error(`Unable to fetch audit logs after messasge delete because of ${error}!`))

        if (fetchedLogs && fetchedLogs.entries.size > 0) {

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

        if (fetchedLogs && fetchedLogs.entries.size > 0) {

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

        if (fetchedLogs && fetchedLogs.entries.size > 0) {

            const creationLog = fetchedLogs.entries.first()
            if (creationLog.target.id == channel.id) {

                channel.executor = creationLog.executor;

            }

        }
        
    }

    await channel.client.onInteractEvent(channel, 'ChannelCreate', true)

}

async function onMemberUpdate(oldMember, newMember, executor=null) {

    if (!newMember.scrimsUser) newMember.client.expandMember(newMember)
    if (!newMember.scrimsUser) return false;
    
    if (newMember.guild) {

        const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_ROLE_UPDATE' })
            .catch(error => console.error(`Unable to fetch audit logs after member update because of ${error}!`))

        if (fetchedLogs && fetchedLogs.entries.size > 0) {

            const updateLog = fetchedLogs.entries.first()
            if (updateLog.target.id === newMember.id) {

                executor = updateLog.executor;

            }

        }
        
    }

    await newMember.client.handleInteractEvent({ oldMember, newMember, executor }, 'MemberUpdate')

}

async function onScrimsMemberUpdate(oldMember, newMember, executor) {

    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {

        const id_user = newMember.client.database.users.cache.find({ discord_id: newMember.id })?.id_user
        if (!id_user) return false; // User has not been added to the bridge scrims database

        if (oldMember.partial) return false; // Member not cached so we can not find out the roles difference
        if (newMember.partial) newMember = await newMember.fetch()

        const lostPositionRoles = getPositionRolesDifference(newMember.client, newMember.guild.id, oldMember.roles, newMember.roles)
        const newPositionRoles = getPositionRolesDifference(newMember.client, newMember.guild.id, newMember.roles, oldMember.roles)

        await newMember.client.handleInteractEvent({ lostPositionRoles, newPositionRoles, member: newMember, executor }, 'MemberPositionRoleUpdate')

    }

}

function getRolesDifference(rolesA, rolesB) {

    return rolesA.cache.filter(roleA => rolesB.cache.filter(roleB => roleB.id === roleA.id).size === 0);

}

function getPositionRoles(bot, guildId, roles) {

    const positionRoles = bot.permissions.getGuildPositionRoles(guildId)
    return [ ...new Set(roles.map(role => positionRoles.filter(roleP => roleP.role_id === role.id)).flat()) ];

}

function getPositionRolesDifference(bot, guildId, rolesA, rolesB) {

    return getPositionRoles(bot, guildId, getRolesDifference(rolesA, rolesB));

}

module.exports = auditEvents;