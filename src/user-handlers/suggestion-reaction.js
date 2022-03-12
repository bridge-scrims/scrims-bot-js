const ResponseTemplates = require("../response-templates");

const maxHue = 120

async function onReactionUpdate(reaction, user) {

    const voteConst = reaction.client.suggestionVoteConst
    const [suggestionUpVote, suggestionDownVote] = [["suggestionUpVote", "👍"], ["suggestionDownVote", "👎"]]
        .map(([key, def]) => reaction.message.guild.emojis.resolve(reaction.client[key]) ?? def)
    
    const suggestion = reaction.client.database.cache.getSuggestion(reaction.message.id)
    if (!suggestion) return false;

    const upVotes = reaction.message.reactions.cache.get(suggestionUpVote.id ?? suggestionUpVote)?.count ?? 0
    const downVotes = reaction.message.reactions.cache.get(suggestionDownVote.id ?? suggestionDownVote)?.count ?? 0

    if ((downVotes/upVotes) > voteConst) {
        await reaction.client.database.removeSuggestion(suggestion.id).catch(console.error)
        await reaction.message.delete();

        return true;
    }

    if ((upVotes/downVotes) > voteConst) {
        const embed = ResponseTemplates.suggestionEmbed(-1, suggestion)
        
        await reaction.message.pin().catch(console.error)
        await reaction.message.edit({ embeds: [embed] }).catch(console.error)

        // Removing it from the database so that the user can not
        // delete it and so that the reaction events are ignored
        await reaction.client.database.removeSuggestion(reaction.message.id)

        const epicChannel = await reaction.message.guild.channels.fetch(reaction.client.epicSuggestionsChannelId)
        if (epicChannel) await epicChannel.send({ 
            content: `**Suggestion has ${upVotes-1} up vote${(upVotes-1)>1 ? "s" : ""} `
                + `and ${((downVotes-1) < 1) ? "no" : `only ${downVotes-1}`} down vote${((downVotes-1) >= 0) ? "s" : ""}!**`,
            embeds: [embed.setFooter({ text: `Suggested in #${reaction.message.channel.name}` }).setTimestamp(suggestion.creation)]
        })

        return true;
    }

    const ratio = (upVotes > downVotes) ? (upVotes / downVotes) : -(downVotes / upVotes)
    const hue = (ratio === -1) ? (maxHue/2) : (ratio * ((maxHue/2) / voteConst)) + (maxHue/2)

    const embed = ResponseTemplates.suggestionEmbed(hue, suggestion)
    await reaction.message.edit({ embeds: [embed] })
    
}


module.exports = onReactionUpdate;