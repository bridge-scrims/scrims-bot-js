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

const RANK_QUEUE_CATEGORIES = {
    "Default": ["759894401957888035"],
    "Prime": ["850031246301069372"],
    "Private": ["773997680850370560"],
    "Premium": ["760199168664535101"]
}

const GAME_CATEOGORIES = ["759950714528727070", "908851492981702737", "908852795296337940"];

/*
const RANK_QUEUE_CATEGORIES = {
    "Default": ["841843351233757195", "841843352764547135"],
    "Prime": [],
    "Private": ["841843351968153600"],
    "Premium": ["841843352256643112"]
}
*/
const QUEUE_CATEGORIES = Object.values(RANK_QUEUE_CATEGORIES).map(v => v[0])

const reservedCalls = {}
const reservedTimeouts = {}

function setReserveTimeout(rollId) {
    clearTimeout(reservedTimeouts[rollId])
    const timeout = setTimeout(() => (delete reservedCalls[rollId]), 30 * 1000)
    reservedTimeouts[rollId] = timeout
}
/**
 * @param {Guild} guild 
 * @param {string} rank
 * @returns {import("discord.js").VoiceBasedChannel[]} 
 */
function getTeamCalls(guild, gameType) {

    return GAME_CATEOGORIES
        .map(v => guild.channels.cache.get(v))
        .filter(v => (v instanceof CategoryChannel))
        .map(v => Array.from(v.children.values())).flat()
        .filter(v => (v instanceof VoiceChannel))
        .sort((a, b) => a.position - b.position)
        .filter(v => /team #\d+|team call \d+/i.test(v.name))
        .filter(v => (!gameType || !GAME_TYPES.some(e => v.name.includes(e)) || v.name.includes(gameType)))
        .filter(v => v.members.size === 0 && !Object.values(reservedCalls).flat().includes(v.id))

}

/** @param {import("discord.js").VoiceBasedChannel} call */
function reserved(call, rollId) {
    reservedCalls[rollId] = [call.id].concat(reservedCalls[rollId] ?? [])
    return call;
}

/** @param {import("discord.js").VoiceBasedChannel} voiceChannel */
function findTeamCall(voiceChannel, rollId) {
    const gameType = GAME_TYPES.find(v => voiceChannel.name.includes(v))
    if (!gameType) return;
    const call = getTeamCalls(voiceChannel.guild, gameType)[0]
    if (call) return reserved(call, rollId);
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

    if (!QUEUE_CATEGORIES.includes(interaction?.channel?.parentId))
        throw new UserError("You must be in a queue channel to use this command!");

    const voiceChannel = interaction.member.voice.channel
    // this ones ok it can stay
    if (!voiceChannel) return interaction.reply({ embeds: [aloneQueueEmbed(interaction.member)], ephemeral: true });

    if (!QUEUE_CATEGORIES.includes(voiceChannel.parentId))
        throw new UserError("You must be in a queue channel to use this command!");

    if (!voiceChannel.full) throw new UserError("The queue channel is not full!");

    const rollId = Date.now()
    setReserveTimeout(rollId)

    await interaction.reply(await getTeamsPayload(voiceChannel, rollId))

}

async function getTeamsPayload(voiceChannel, rollId) {

    const command = getDuelCommand(voiceChannel)
    const members = mixCollection(voiceChannel.members)
    const teamSize = Math.ceil(members.length / 2)

    const actions = new MessageActionRow().addComponents(
        (new MessageButton()).setCustomId(`reroll/${rollId}/${voiceChannel.id}`).setLabel("Reroll").setStyle("PRIMARY").setEmoji("🎲")
    )
    const team1 = await getTeamEmbed("First Team", "#463756", members.slice(0, teamSize), findTeamCall(voiceChannel, rollId), command)
    const team2 = await getTeamEmbed("Second Team", "#A14F50", members.slice(teamSize), findTeamCall(voiceChannel, rollId), command)
    return { embeds: [team1, team2], components: [actions] };

}

/**
 * @param {import("../types").ScrimsComponentInteraction} interaction 
 */
async function onRerollCommand(interaction) {

    const [rollId, channelId] = interaction.args

    const voiceChannel = interaction.member.voice.channel
    if (!voiceChannel || voiceChannel.id !== channelId)
        throw new UserError("You are not in the correct voice channel to do this!");

    if (!voiceChannel.full) throw new UserError("Someone left the queue channel!");

    delete reservedCalls[rollId]
    setReserveTimeout(rollId)

    await interaction.update(await getTeamsPayload(voiceChannel, rollId))

}

/**
 * @param {import("discord.js").VoiceBasedChannel} teamCall 
 */
async function getTeamEmbed(title, color, members, teamCall, command) {

    const embed = new MessageEmbed().setTitle(title).setColor(color)

    if (!(members?.length > 0)) return embed.setDescription("*Empty*");
    embed.addField("Members", members.join(" "))

    /*
    const igns = members.map(m => parseIGN(m.displayName).replaceAll(/(?![a-zA-Z0-9_])./g, ""))
    if (igns.length >= 2) embed.addField("Party Commands", `\`•\` /p transfer ${igns[0]}` + `\n\`•\` /p ${igns.slice(1).join(" ")}`)
    */
    
    if (teamCall) {
        const invite = await teamCall.createInvite({
            maxAge: 60 * 60,
            reason: "Team call!"
        });
        embed.addField("Team Call", `${teamCall} *[click to join](${invite})*`)
    }

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
            const start = name.slice(idx + find.length).trim()
            return start.slice(0, start.search(/(?![a-zA-Z0-9_])/) + 1 ?? name.length);
        }
    }

    for (const search of ["/duel ", "ign ", "ign:", "ign="]) {
        const result = find(search)
        if (result) return result;
    }

    return name.slice(0, name.search(/(?![a-zA-Z0-9_])/) + 1 ?? name.length).slice(0, 13);

}

function buildTeamsCommand() {
    const command = new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Use this command to generate two teams.')

    return [command, { allowedPositions: ["bridge_scrims_member"], positionLevel: "support" }, { forceGuild: true }];
}

function buildRerollCommand() {
    return ["reroll", { allowedPositions: ["bridge_scrims_member"], positionLevel: "support" }, { forceGuild: true }];
}

module.exports = {
    commandHandler: onCommand,
    commands: [buildTeamsCommand(), buildRerollCommand()]
}