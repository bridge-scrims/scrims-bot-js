const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, CategoryChannel, VoiceChannel, Guild, Collection, MessageActionRow, MessageButton } = require("discord.js");
const UserError = require("../lib/tools/user_error");

const commandHandlers = {
    teams: onTeamsCommand,
    reroll: onRerollCommand
}

/**
 * @param {import("../types").ScrimsInteraction} interaction 
 */
async function onCommand(interaction) {

    const handler = commandHandlers[interaction.commandName]
    if (handler) return handler(interaction);

    throw new Error(`Interaction with name '${interaction.commandName}' does not have a handler!`, commandHandlers);

}

const GAME_TYPES = ["1v1", "2v2", "3v3", "4v4"]
const GAME_RANKS = ["Default", "Prime", "Private", "Premium"]
const DUEL_COMMANDS = ["bridge", "bridge_doubles", "bridge_threes", "bridge_teams"]

const RANK_QUEUE_CATEGORYS = {
    "Default": ["759894401957888035", "759950714528727070", "908851492981702737", "908852795296337940"],
    "Prime": ["850031246301069372"],
    "Private": ["773997680850370560"],
    "Premium": ["760199168664535101"]
}

/*
const RANK_QUEUE_CATEGORYS = {
    "Default": ["841843351233757195", "841843352764547135"],
    "Prime": [],
    "Private": ["841843351968153600"],
    "Premium": ["841843352256643112"]
}
*/

const QUEUE_CATEGORYS = Object.values(RANK_QUEUE_CATEGORYS).map(v => v[0])
const RESERVED_CALLS = {}
const RESERVED_TIMEOUTS = {}

function setReserveTimeout(rollId) {
    clearTimeout(RESERVED_TIMEOUTS[rollId])
    const timeout = setTimeout(() => (delete RESERVED_CALLS[rollId]), 30*1000)
    RESERVED_TIMEOUTS[rollId] = timeout
}
/**
 * @param {Guild} guild 
 * @param {string} rank
 * @returns {import("discord.js").VoiceBasedChannel[]} 
 */
function getRankTeamCalls(guild, rank, gameType) {

    return (RANK_QUEUE_CATEGORYS[rank] ?? [])
        .map(v => guild.channels.cache.get(v))
        .filter(v => (v instanceof CategoryChannel))
        .map(v => Array.from(v.children.values())).flat()
        .filter(v => (v instanceof VoiceChannel))
        .sort((a, b) => a.position - b.position)
        .filter(v => /team #\d+|team call \d+/i.test(v.name))
        .filter(v => (!gameType || !GAME_TYPES.some(e => v.name.includes(e)) || v.name.includes(gameType)))
        .filter(v => v.members.size === 0 && !Object.values(RESERVED_CALLS).flat().includes(v.id))

}

/** @param {import("discord.js").VoiceBasedChannel} call */
function reserved(call, rollId) {
    RESERVED_CALLS[rollId] = [call.id].concat(RESERVED_CALLS[rollId] ?? [])
    return call;
}

/** @param {import("discord.js").VoiceBasedChannel} voiceChannel */
function findTeamCall(voiceChannel, rollId) {

    const gameType = GAME_TYPES.find(v => voiceChannel.name.includes(v))
    const gameRankIndex = Object.values(RANK_QUEUE_CATEGORYS).findIndex(v => v.includes(voiceChannel.parentId))
    if (!gameType || gameRankIndex === -1) return;

    for (const rank of GAME_RANKS.slice(0, gameRankIndex+1).reverse()) {
        const call = getRankTeamCalls(voiceChannel.guild, rank, gameType)[0]
        if (call) return reserved(call, rollId);
    }

}

function getDuelCommand(voiceChannel) {
    return DUEL_COMMANDS[GAME_TYPES.findIndex(v => voiceChannel.name.includes(v))] ?? "";
}

/** 
 * @template V
 * @param {Collection<any, V>} collection 
 * @returns {V[]}
 */
function mixCollection(collection) {
    return collection
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)
}

/**
 * @param {import("../types").ScrimsCommandInteraction} interaction 
 */
async function onTeamsCommand(interaction) {

    if (!QUEUE_CATEGORYS.includes(interaction?.channel?.parentId))
        throw new UserError("This channel is just not the queue channel 🙄")

    const voiceChannel = interaction.member.voice.channel
    if (!voiceChannel) return interaction.reply({ embeds: [aloneQueueEmbed(interaction.member)], ephemeral: true });
        
    if (!QUEUE_CATEGORYS.includes(voiceChannel.parentId))
        throw new UserError("This channel is just not the queue call 🙄")

    if (!voiceChannel.full) throw new UserError("Now in which universe do you think this call is full 🤦‍♂️")
    
    const rollId = Date.now()
    setReserveTimeout(rollId)

    await interaction.reply(getTeamsPayload(voiceChannel, rollId))

}

function getTeamsPayload(voiceChannel, rollId) {

    const command = getDuelCommand(voiceChannel)
    const members = mixCollection(voiceChannel.members)
    const teamSize = Math.ceil(members.length/2)

    const actions = new MessageActionRow().addComponents(
        (new MessageButton()).setCustomId(`reroll/${rollId}/${voiceChannel.id}`).setLabel("Reroll").setStyle("PRIMARY").setEmoji("🎲")
    )
    const team1 = getTeamEmbed("First Team", "#463756", members.slice(0, teamSize), findTeamCall(voiceChannel, rollId), command)
    const team2 = getTeamEmbed("Second Team", "#A14F50", members.slice(teamSize), findTeamCall(voiceChannel, rollId), command)
    return { embeds: [team1, team2], components: [actions] };

}

/**
 * @param {import("../types").ScrimsComponentInteraction} interaction 
 */
async function onRerollCommand(interaction) {

    const [rollId, channelId] = interaction.args

    const voiceChannel = interaction.member.voice.channel
    if (!voiceChannel || voiceChannel.id !== channelId) 
        throw new UserError("Excuse me?! You don't have permission to push my buttons 😉")

    if (!voiceChannel.full) throw new UserError("Now in which universe do you think this call is full 🤦‍♂️")

    delete RESERVED_CALLS[rollId]
    setReserveTimeout(rollId)

    await interaction.update(getTeamsPayload(voiceChannel, rollId))

}

function getTeamEmbed(title, color, members, teamCall, command) {

    const embed = new MessageEmbed().setTitle(title).setColor(color)

    if (!(members?.length > 0)) return embed.setDescription("*Empty*");
    embed.addField("Members", members.join(" "))

    /*
    const igns = members.map(m => parseIGN(m.displayName).replaceAll(/(?![a-zA-Z0-9_])./g, ""))
    if (igns.length >= 2) embed.addField("Party Commands", `\`•\` /p transfer ${igns[0]}` + `\n\`•\` /p ${igns.slice(1).join(" ")}`)
    */

    if (teamCall) embed.addField("Team Call", `${teamCall} *(click to join)*`)
    
    // embed.setDescription(`/duel ${igns[0]} ${command}`)

    return embed;

}

function aloneQueueEmbed(member) {
    const embed = new MessageEmbed().setTitle("Teams").setColor("#00ff51").setFooter({ text: "(Maybe join a queue call first)" })
    const members = mixCollection([member, "🦍 Imaginary Friend 1", "🐸 Imaginary Friend 2", "🐈 Imaginary Friend 3"])
    embed.addField("Team 1", members.slice(0, 2).join("\n"), true)
    embed.addField("Team 2", members.slice(2, 4).join("\n"), true)
    return embed;
}

function parseIGN(name) {

    const find = (find) => {
        const idx = name.toLowerCase().indexOf(find)
        if (idx !== -1) {
            const start = name.slice(idx+find.length).trim()
            return start.slice(0, start.search(/(?![a-zA-Z0-9_])/)+1 ?? name.length);
        }
    }

    for (const search of ["/duel ", "ign ", "ign:", "ign="]) {
        const result = find(search)
        if (result) return result;
    }

    return name.slice(0, name.search(/(?![a-zA-Z0-9_])/)+1 ?? name.length);

}

function buildTeamsCommand() {
    const command = new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Use this command to generate two teams.')

    return [ command, { allowedPositions: ["bridge_scrims_member"], positionLevel: "support" }, { forceGuild: true } ];
}

function buildRerollCommand() {
    return [ "reroll", { allowedPositions: ["bridge_scrims_member"], positionLevel: "support" }, { forceGuild: true } ];
}

module.exports = {
    commandHandler: onCommand,
    commands: [ buildTeamsCommand(), buildRerollCommand() ]
}