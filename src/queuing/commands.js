const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");
const UserError = require("../lib/tools/user_error");

const commandHandlers = {
    teams: onTeamsCommand
}

/**
 * @param {import("../types").ScrimsInteraction} interaction 
 */
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) return handler(interaction);

    throw new Error(`Interaction with name '${interaction.commandName}' does not have a handler!`, commandHandlers);

}

const categorys = ["759894401957888035", "850031246301069372", "773997680850370560", "760199168664535101", "911760601926217821"]

/**
 * @param {import("../types").ScrimsCommandInteraction} interaction 
 */
async function onTeamsCommand(interaction) {

    if (!categorys.includes(interaction?.channel?.parentId))
        throw new UserError("This command should only be used in the queue channels!")

    const voiceChannel = interaction.member.voice.channel
    if (!voiceChannel || !categorys.includes(voiceChannel.parentId)) 
        throw new UserError("You must join a queue call to use this command!")

    if (!voiceChannel.full) throw new UserError("Please wait for this queue to fill up completely before using this command.")

    const members = voiceChannel.members
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)

    const teamSize = Math.ceil(members.length/2)
    const embed = new MessageEmbed()
        .setTitle("Teams").setColor("#00ff86")
        .addField("First Team", members.slice(0, teamSize).join("\n") || "*Empty*", true)
        .addField("Second Team", members.slice(teamSize).join("\n") || "*Empty*", true)

    await interaction.reply({ embeds: [embed] })

}

function buildTeamsCommand() {

    const command = new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Use this command to generate two teams.')

    return [ command, { allowedPositions: ["bridge_scrims_member"], positionLevel: "support" }, { forceGuild: true } ];

}

module.exports = {
    commandHandler: onCommand,
    commands: [ buildTeamsCommand() ]
}