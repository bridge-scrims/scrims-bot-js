const SuggestionsResponseMessageBuilder = require('./responses');

const maxHue = 120

async function onReactionUpdate(reaction) {

    const voteConst = reaction.client.suggestions.getVoteConst(reaction.message.guild.id)
    if (!voteConst) return false;

    const [suggestionUpVote, suggestionDownVote] = reaction.client.suggestions.getVoteEmojis(reaction.message.guild)
    
    const suggestionData = reaction.client.database.suggestions.cache.find({ message_id: reaction.message.id })[0]
    if (!suggestionData) return false;

    const upVotes = reaction.message.reactions.cache.get(suggestionUpVote.id ?? suggestionUpVote)?.count || 1;
    const downVotes = reaction.message.reactions.cache.get(suggestionDownVote.id ?? suggestionDownVote)?.count || 1;
    const suggestion = { ...suggestionData.toJSON(), upVotes, downVotes }

    if ((downVotes/upVotes) > voteConst) return onUnpopularSuggestion(reaction.client, reaction.message, suggestion);

    if ((upVotes/downVotes) > voteConst) return onPopularSuggestion(reaction.client, reaction.message, suggestion);

    const ratio = (upVotes > downVotes) ? (upVotes / downVotes) : -(downVotes / upVotes)
    const hue = (ratio === -1) ? (maxHue/2) : (ratio * ((maxHue/2) / voteConst)) + (maxHue/2)

    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(
        hue, suggestionData.suggestion, suggestionData.created_at*1000, reaction.client.users.resolve(suggestion.creator.discord_id)
    )
    
    await reaction.message.edit({ embeds: [embed] })
    
}

async function onUnpopularSuggestion(client, message, suggestion) {

    if (suggestion.epic) return false;

    const context = { 

        guild_id: message.guild.id,
        executor_id: client.user.id,
        suggestion

    }

    // Remove from cache so that when the message delete event arrives it will not trigger anything
    const removed = client.database.suggestions.cache.remove(suggestion.id_suggestion)

    const response = await message.delete().catch(error => error)
    if (response === false) {

        // Deleting the message failed so add the suggestion back to cache
        client.database.suggestions.cache.push(removed)

        await client.suggestions.logError(`Failed to remove suggestion after it getting ${suggestion.downVotes} down vote(s).`, { context, error: response })
        return false;

    }
    
    await client.suggestions.logError(`Removed a suggestion because of it getting **${suggestion.downVotes}** \`down vote(s)\` with only **${suggestion.upVotes}** \`up vote(s)\`.`, context)

    await client.database.suggestions.remove({ id_suggestion: suggestion.id_suggestion })
        .catch(error => console.error(`Unable to remove suggestion from database because of ${error}!`, suggestion))

}

async function onPopularSuggestion(client, message, suggestion) {
    
    const { upVotes, downVotes } = suggestion
    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(
        -1, suggestion.suggestion, suggestion.created_at*1000, client.users.resolve(suggestion.creator.discord_id)
    )
        
    //if (!message.pinned) await message.pin().catch(console.error)
    await message.edit({ embeds: [embed] }).catch(console.error)

    if (suggestion.epic) return false;
    
    await client.database.suggestions.update({ id_suggestion: suggestion.id_suggestion }, { epic: Math.round(Date.now()/1000) })

    const [suggestionUpVote, suggestionDownVote] = client.suggestions.getVoteEmojis(message.guild)

    const epicEmbed = embed.setFooter({ text: `Suggested in #${message.channel.name}` }).setTimestamp(suggestion.creation)
    const voteStatus = `**${upVotes-1}** ${suggestionUpVote}   **${downVotes-1}** ${suggestionDownVote}`
    await client.suggestions.sendEpicSuggestion(message.guild, epicEmbed, voteStatus)
    
}


module.exports = onReactionUpdate;