const ResponseTemplates = require("../response-templates");

const maxHue = 120
const voteConst = 40

async function onReactionUpdate(reaction, user) {

    const [suggestionUpVote, suggestionDownVote] = [["suggestionUpVote", "👍"], ["suggestionDownVote", "👎"]]
        .map(([key, def]) => reaction.message.guild.emojis.resolve(reaction.client[key]) ?? def)
    
    const suggestion = reaction.client.database.cache.getSuggestion(reaction.message.id)
    if (!suggestion) return false;

    const upVotes = reaction.message.reactions.cache.get(suggestionUpVote.id ?? suggestionUpVote)?.count ?? 0
    const downVotes = reaction.message.reactions.cache.get(suggestionDownVote.id ?? suggestionDownVote)?.count ?? 0

    if ((downVotes/upVotes) > voteConst) {
        await reaction.client.database.removeSuggestion(suggestion.id).catch(console.error)
        return reaction.message.delete();
    }

    const ratio = (upVotes > downVotes) ? (upVotes / downVotes) : -(downVotes / upVotes)
    const hue = (ratio === -1) ? (maxHue/2) : (ratio * ((maxHue/2) / voteConst)) + (maxHue/2)

    const embed = ResponseTemplates.suggestionEmbed(hue, suggestion)
    await reaction.message.edit({ embeds: [embed] })
    
}


module.exports = onReactionUpdate;