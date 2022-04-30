
const { v4: uuidv4 } = require("uuid");
const newDBClient = require("./lib/postgresql/database");
const oldDBClient = require("./oldlib/postgresql/database");
const newScrimsSuggestion = require("./suggestions/suggestion");
const oldScrimsSuggestion = require("./oldsuggestions/suggestion");

const Config = require("../src/config.json");

async function fix() {

    const newDatabase = new newDBClient(null, { ...Config.dbLogin, database: 'scrims_temp' })
    newDatabase.addTable("suggestions", new newScrimsSuggestion.Table(newDatabase))

    const oldDatabase = new oldDBClient(null, Config.dbLogin)
    oldDatabase.addTable("suggestions", new oldScrimsSuggestion.Table(oldDatabase))

    console.log("adding users...")
    const existingUserDiscords = await newDatabase.users.get({ }, false).then(users => users.map(user => user.discord_id))
    const users = await oldDatabase.users.get({ }, false)
    await Promise.all(
        users
            .filter(user => !existingUserDiscords.includes(user.discord_id))
            .map(user => newDatabase.users.create({ ...user.toJSON(), id_user: uuidv4() }).catch(console.error))
    )

    console.log("adding positions...")
    const existingPositionNames = await newDatabase.positions.get({ }, false).then(positions => positions.map(pos => pos.name))
    const positions = await oldDatabase.positions.get({ }, false)
    await Promise.all(
        positions
            .filter(position => !existingPositionNames.includes(position.name))
            .map(position => newDatabase.positions.create({ ...position.toJSON(), id_position: uuidv4() }).catch(console.error))
    )

    const existingUserPositions = await newDatabase.userPositions.getArrayMap({ }, ['user', 'discord_id'], false)
    console.log(`found ${Object.values(existingUserPositions).length} existing user positions...`)
    const userPositions = await oldDatabase.userPositions.get({ }, false).then(userPositions => 
        userPositions.filter(userPos => !existingUserPositions[userPos.user?.discord_id] || existingUserPositions[userPos.user?.discord_id].filter(existing => existing.position?.name === userPos.position?.name).length === 0)
    )

    console.log(`adding ${userPositions.length} new user positions...`)
    await Promise.all(userPositions
        .map(userPos => newDatabase.userPositions.create({ 
            user: { discord_id: userPos.user.discord_id }, position: { name: userPos.position.name }, 
            ...(userPos.executor ? { executor: { discord_id: userPos.executor.discord_id } } : { id_executor: null }), 
            given_at: userPos.given_at, expires_at: userPos.expires_at
    }).catch(console.error)))

    await newDatabase.query(`DELETE FROM scrims_guild_entry;`)
    const guildEntrys = await oldDatabase.guildEntrys.get({ }, false)
    console.log(`adding ${guildEntrys.length} new user guild entrys...`)
    await Promise.all(guildEntrys.map(entry => newDatabase.guildEntrys.create({ 
        guild_id: entry.guild_id, value: entry.value, type: { name: entry.type.name }
    }).catch(console.error)))

    await newDatabase.query(`DELETE FROM scrims_position_role;`)
    const positionRoles = await oldDatabase.positionRoles.get({ }, false)
    console.log(`adding ${positionRoles.length} new position roles...`)
    await Promise.all(positionRoles.map(posRole => newDatabase.positionRoles.create({ 
        position: { name: posRole.position.name }, role_id: posRole.role_id, guild_id: posRole.guild_id
    }).catch(console.error)))

    await newDatabase.query(`DELETE FROM scrims_ticket_message;`)
    await newDatabase.query(`DELETE FROM scrims_ticket;`)
    const tickets = await oldDatabase.tickets.get({ }, false)
    console.log(`adding ${tickets.length} new tickets...`)
    await Promise.all(tickets.map(ticket => newDatabase.tickets.create({ 
        id_ticket: uuidv4(), type: { name: ticket.type.name }, user: { discord_id: ticket.user.discord_id }, status: { name: ticket.status.name },
        guild_id: ticket.guild_id, channel_id: ticket.channel_id, created_at: ticket.created_at
    }).catch(console.error)))

    const ticketMessages = await oldDatabase.ticketMessages.get({ }, false)
    console.log(`adding ${ticketMessages.length} new ticket messages...`)
    await Promise.all(ticketMessages.map(msg => newDatabase.ticketMessages.create({ 
        ticket: { created_at: msg.ticket.created_at }, author: { discord_id: msg.author.discord_id }, 
        message_id: msg.message_id, content: msg.content, created_at: msg.created_at, deleted: msg.deleted 
    }).catch(console.error)))

    await newDatabase.query(`DELETE FROM scrims_suggestion;`)
    const suggestions = await oldDatabase.suggestions.get({ }, false)
    console.log(`adding ${suggestions.length} new suggestions...`)
    await Promise.all(suggestions.map(suggestion => newDatabase.suggestions.create({ 
        id_suggestion: uuidv4(), guild_id: suggestion.guild_id, channel_id: suggestion.channel_id, message_id: suggestion.message_id,
        suggestion: suggestion.suggestion, created_at: suggestion.created_at, creator: { discord_id: suggestion.creator.discord_id }, epic: suggestion.epic
    }).catch(console.error)))

}

fix()