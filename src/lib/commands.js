const ScrimsMessageBuilder = require("../lib/responses");

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageButton } = require("discord.js");

const interactionHandlers = {

    "killAction": onKillAction,
    "reload": onReloadCommand,
    "config": onConfigCommand,
    "kill": onKillCommand

}
async function onInteraction(interaction) {

    const interactionHandler = interactionHandlers[interaction.commandName]
    if (interactionHandler) return interactionHandler(interaction);

    await interaction.reply({ content: `How did we get here?`, ephemeral: true })

}

async function onKillAction(interaction) {

    const action = interaction.args.shift()

    if (action === 'KILL') {

        await interaction.deferUpdate()
        return kill(interaction);

    }

    if (action === 'CANCEL') {

        interaction.client.blocked = false
        return interaction.update({ content: 'Shutdown cancelled.', components: [] });

    }

}

async function onReloadCommand(interaction) {

    await interaction.deferReply({ ephemeral: true })

    await interaction.client.database.guilds.initializeCache()
    await interaction.client.database.guildEntryTypes.initializeCache()
    await interaction.client.database.guildEntrys.initializeCache()  

    await interaction.client.database.users.initializeCache()
    await interaction.client.database.positions.initializeCache()
    await interaction.client.database.userPositions.initializeCache()
    await interaction.client.database.positionRoles.initializeCache()

    await interaction.client.commands.update().catch(console.error)

    await interaction.editReply({ content: "Everything was reloaded!", ephemeral: true })

}

async function kill(interaction) {

    const payload = { content: `👋 **Goodbye**`, embeds: [], components: [], ephemeral: true }

    if (interaction.replied || interaction.deferred) await interaction.editReply(payload).catch(console.error)
    else await interaction.reply(payload).catch(console.error)

    interaction.client.destroy()
    process.exit(0)

}

async function onKillCommand(interaction) {

    /**
     * @type { import("./bot") }
     */
    const bot = interaction.client

    bot.blocked = true
    bot.handles = bot.handles.filter(v => v !== interaction.id)

    if (bot.handles.length === 0) return kill(interaction);

    const message = `⚠️ **Now rejecting interactions!**\n_ _\n`
        + `I am waiting for \`${bot.handles.length}\` interaction handler(s) to finish before I shutdown. `
        + `I will keep you updated on my progress by editing this message.`

    const actions = new MessageActionRow().addComponents(
        new MessageButton().setCustomId('killAction/KILL').setLabel('Force Kill').setStyle('DANGER'),
        new MessageButton().setCustomId('killAction/CANCEL').setLabel('Cancel').setStyle('SECONDARY')
    )

    await interaction.reply({ content: message, components: [actions], ephemeral: true })

    const expiration = interaction.createdTimestamp + 14*60*1000

    const blocked = {}
    bot.on('blocked', name => (name in blocked) ? blocked[name] += 1 : blocked[name] = 1)

    while(expiration > Date.now()) {

        await new Promise(resolve => setTimeout(resolve, 5*1000))
        if (!bot.blocked) return interaction.editReply({ content: 'Shutdown cancelled.', components: [] });
        if (bot.handles.length === 0) return kill(interaction);

        const blockedMessages = Object.entries(blocked).map(([key, value]) => `\`${value}\` **${key + ((value > 1) ? 's' : '')}**`)
        const blockedMessage = [blockedMessages.slice(0, -1).join(', '), blockedMessages.slice(-1)[0]].filter(v => v).join(' and ')
            + ` ${(Object.values(blocked).reduce((pv, cv) => pv + cv, 0) > 1) ? 'were' : 'was'} rejected!`

        const message = `⚠️ ${(Object.values(blocked).length === 0) ? '**Now rejecting interactions!**' : blockedMessage}\n_ _\n`
            + `I am waiting for \`${bot.handles.length}\` interaction handler(s) to finish before I shutdown. `
            + `I will keep you updated on my progress by editing this message.`

        await interaction.editReply({ content: message, ephemeral: true })

    }

    bot.blocked = false
    await interaction.editReply({ content: `Shutdown failed because of this interaction expiring.`, components: [], ephemeral: true })

}

async function onConfigAutocomplete(interaction) {

    const focused = interaction.options.getFocused().toLowerCase()

    const entryTypes = interaction.client.database.guildEntryTypes.cache.data
    const relevant = entryTypes.filter(type => type.name.toLowerCase().includes(focused))
    
    await interaction.respond([ { name: "All", value: -1 }, ...relevant.map(type => ({ name: type.name, value: type.id_type })) ])

}

async function onConfigCommand(interaction) {

    if (interaction.isAutocomplete()) return onConfigAutocomplete(interaction);
    if (!interaction.guild) return interaction.reply( ScrimsMessageBuilder.guildOnlyMessage() );

    const entryTypeId = interaction.options.getInteger("key")
    const value = interaction.options.getString("value") ?? null

    if (entryTypeId === -1) {

        const entrys = await interaction.client.database.guildEntrys.get({ guild: { discord_id: interaction.guild.id } })

        if (entrys.length === 0) return interaction.reply({ content: "Nothing configured for this guild." });
        
        return interaction.reply(ScrimsMessageBuilder.configEntrysMessage(entrys));

    }

    const selector = { guild: { discord_id: interaction.guild.id }, id_type: entryTypeId }
    const entrys = await interaction.client.database.guildEntrys.get(selector)

    if (!value) return interaction.reply({ content: `${entrys[0]?.value || null}`, allowedMentions: { parse: [] }, ephemeral: true });
    
    if (entrys.length > 0) {

        const oldValue = entrys[0].value
        
        await interaction.client.database.guildEntrys.update(selector, { value })
        return interaction.reply({ content: `${oldValue} **->** ${value}`, allowedMentions: { parse: [] }, ephemeral: true });

    }

    await interaction.client.database.guildEntrys.create({ ...selector, value })
    await interaction.reply({ content: `${value}`, allowedMentions: { parse: [] }, ephemeral: true })

} 

function getReloadCommand() {

    const reloadCommand = new SlashCommandBuilder()
        .setName("reload")
        .setDescription("Reloads the application commands and permissions.")
    
    return [ reloadCommand, { permissionLevel: "staff" } ];

}

function getConfigCommand() {

    const configCommand = new SlashCommandBuilder()
        .setName("config")
        .setDescription("Used to configure the bot for this discord server.")
        .addIntegerOption(option => (
            option
                .setName("key")
                .setDescription("What exact you are trying to configure.")
                .setAutocomplete(true)
                .setRequired(true)
        ))
        .addStringOption(option => (
            option
                .setName("value")
                .setDescription("The new value of the key you choose.")
                .setRequired(false)
        ))
    
    return [ configCommand, { permissionLevel: "owner" } ];

}

function getPingCommand() {

    const pingCommand = new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Used to test the bots connection.")
    
    return [ pingCommand, { } ];

}

function getKillCommand() {

    const killCommand = new SlashCommandBuilder()
        .setName("kill")
        .setDescription("Used to kill the bot.")
    
    return [ killCommand, { permissionLevel: "owner" } ];

}

module.exports = {

    interactionHandler: onInteraction,
    eventHandlers: ['killAction'],
    commands: [ getReloadCommand(), getConfigCommand(), getPingCommand(), getKillCommand() ]

}
