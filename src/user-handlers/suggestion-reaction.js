const ResponseTemplates = require("../response-templates");

const maxHue = 120
const voteConst = 40

async function onReactionUpdate(reaction, user) {
    const [suggestionUpVote, suggestionDownVote] = [reaction.client.suggestionUpVote, reaction.client.suggestionDownVote]
    if (reaction.emoji.id != suggestionUpVote.id && reaction.emoji.id != suggestionDownVote.id) return false;
    
    const suggestion = reaction.client.database.cache.getSuggestion(reaction.message.id)
    if (!suggestion) return false;

    const upVotes = reaction.message.reactions.cache.filter(reaction => reaction.emoji.id == suggestionUpVote.id).size
    const downVotes = reaction.message.reactions.cache.filter(reaction => reaction.emoji.id == suggestionDownVote.id).size

    console.log([upVotes, downVotes])
    const ratio = (upVotes > downVotes) ? (upVotes / downVotes) : (downVotes / upVotes)
    console.log(ratio)
    const hue = (ratio === 1) ? (maxHue/2) : (ratio * ((maxHue/2) / voteConst)) + ((upVotes > downVotes) ? (maxHue/2) : 0)
    console.log(hue)

    const embed = ResponseTemplates.suggestionEmbed(hue, suggestion)
    await reaction.message.edit({ embeds: [embed] }).catch(console.error)
}


module.exports = onReactionUpdate;