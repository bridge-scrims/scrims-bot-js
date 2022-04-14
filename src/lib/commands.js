const ScrimsMessageBuilder = require("../lib/responses");

const { SlashCommandBuilder } = require("@discordjs/builders");

const interactionHandlers = {

    "reload": onReloadCommand,
    "config": onConfigCommand

}
async function onInteraction(interaction) {

    const interactionHandler = interactionHandlers[interaction.commandName]
    if (interactionHandler) return interactionHandler(interaction);

    await interaction.reply({ content: `How did we get here?`, ephemeral: true })

}

async function onReloadCommand(interaction) {

    await interaction.deferReply({ ephemeral: true })

    await interaction.client.database.positions.get({ }, false)
    await interaction.client.database.userPositions.get({ }, false)
    await interaction.client.database.positionRoles.get({ }, false)

    await interaction.client.commands.update().catch(console.error)

    await interaction.editReply({ content: "Commands reloaded!", ephemeral: true })

}

async function onConfigAutocomplete(interaction) {

    const focused = interaction.options.getFocused().toLowerCase()

    const entryTypes = await this.database.guildEntryTypes.get({ }, false)
    const relevant = entryTypes.filter(type => type.name.toLowerCase().includes(focused))
    
    await interaction.respond([ { name: "All", value: -1 }, ...relevant.map(type => ({ name: type.name, value: type.id_type })) ])

}

async function onConfigCommand(interaction) {

    if (interaction.isAutocomplete()) return onConfigAutocomplete(interaction);
    if (!interaction.guild) return interaction.reply( ScrimsMessageBuilder.guildOnlyMessage() );

    const entryTypeId = interaction.options.getInteger("key")
    const value = interaction.options.getString("value") ?? null

    if (entryTypeId === -1) {

        const entrys = await interaction.client.database.guildEntrys.get({ guild_id: interaction.guild.id })

        if (entrys.length === 0) return interaction.reply({ content: "Nothing configured for this guild." });
        
        return interaction.reply(ScrimsMessageBuilder.configEntrysMessage(entrys));

    }

    const selector = { guild_id: interaction.guild.id, id_type: entryTypeId }
    const entry = await interaction.client.database.guildEntrys.get(selector)

    if (!value) return interaction.reply({ content: `${entry[0]?.value || null}`, allowedMentions: { parse: [] }, ephemeral: true });
    
    if (entry.length > 0) {

        const oldValue = entry[0].value
        
        await interaction.client.database.guildEntrys.update(selector, { value })
        return interaction.reply({ content: `${oldValue} **->** ${value}`, allowedMentions: { parse: [] }, ephemeral: true });

    }

    await interaction.client.database.guildEntrys.create({ ...selector, value })
    await interaction.reply({ content: `${value}`, allowedMentions: { parse: [] }, ephemeral: true });

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

module.exports = {

    interactionHandler: onInteraction,
    commands: [ getReloadCommand(), getConfigCommand() ]

}
