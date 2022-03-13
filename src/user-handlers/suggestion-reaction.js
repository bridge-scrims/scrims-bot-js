const ResponseTemplates = require("../response-templates");

const maxHue = 120

async function onReactionUpdate(reaction, user) {

    const voteConst = reaction.client.suggestionVoteConst
    const [suggestionUpVote, suggestionDownVote] = [["suggestionUpVote", "👍"], ["suggestionDownVote", "👎"]]
        .map(([key, def]) => reaction.message.guild.emojis.resolve(reaction.client[key]) ?? def)
    
    const suggestionData = reaction.client.database.cache.getSuggestion(reaction.message.id)
    if (!suggestionData) return false;

    const upVotes = reaction.message.reactions.cache.get(suggestionUpVote.id ?? suggestionUpVote)?.count || 1;
    const downVotes = reaction.message.reactions.cache.get(suggestionDownVote.id ?? suggestionDownVote)?.count || 1;
    const suggestion = { ...suggestionData, upVotes, downVotes }

    if ((downVotes/upVotes) > voteConst) return onUnpopularSuggestion(reaction.client, reaction.message, suggestion);

    if ((upVotes/downVotes) > voteConst) return onPopularSuggestion(reaction.client, reaction.message, suggestion);

    const ratio = (upVotes > downVotes) ? (upVotes / downVotes) : -(downVotes / upVotes)
    const hue = (ratio === -1) ? (maxHue/2) : (ratio * ((maxHue/2) / voteConst)) + (maxHue/2)

    const embed = ResponseTemplates.suggestionEmbed(hue, suggestion)
    await reaction.message.edit({ embeds: [embed] })
    
}

async function onUnpopularSuggestion(client, message, suggestion) {
    await client.database.removeSuggestion(suggestion.id).catch(console.error)
    await message.delete();
}

async function onPopularSuggestion(client, message, suggestion) {
    const { upVotes, downVotes } = suggestion
    const embed = ResponseTemplates.suggestionEmbed(-1, suggestion)
        
    await message.pin().catch(console.error)
    await message.edit({ embeds: [embed] }).catch(console.error)

    // Removing it from the database so that the user can not
    // delete it and so that the reaction events are ignored
    await client.database.removeSuggestion(message.id)

    const epicChannel = await message.guild.channels.fetch(client.epicSuggestionsChannelId)
    if (epicChannel) await epicChannel.send({ 
        content: `**Suggestion has ${upVotes-1} up vote${(upVotes-1)>1 ? "s" : ""} `
            + `and ${((downVotes-1) < 1) ? "no" : `only ${downVotes-1}`} down vote${((downVotes-1) >= 0) ? "s" : ""}!**`,
        embeds: [embed.setFooter({ text: `Suggested in #${message.channel.name}` }).setTimestamp(suggestion.creation)]
    })
}


module.exports = onReactionUpdate;