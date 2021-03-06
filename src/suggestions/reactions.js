const SuggestionsResponseMessageBuilder = require('./responses');

const maxHue = 120
const cooldownTimer = {}
const lastUpdate = {}

function getTimeout(messageId) {

    if (!lastUpdate[messageId]) return 0;
    return (lastUpdate[messageId] + 5*1000) - Date.now();
    
}

async function onReactionUpdate(reaction) {

    if (getTimeout(reaction.message.id) > 0) {

        const cooldown = cooldownTimer[reaction.message.id]
        if (cooldown) clearTimeout(cooldown)

        cooldownTimer[reaction.message.id] = setTimeout(() => onReactionUpdate(reaction).catch(console.error), getTimeout(reaction.message.id))
        return false;
        
    }

    lastUpdate[reaction.message.id] = Date.now()

    const voteConst = reaction.client.suggestions.getVoteConst(reaction.message.guild.id)
    if (!voteConst) return false;
    
    const suggestion = reaction.client.database.suggestions.cache.find({ message_id: reaction.message.id })
    if (!suggestion) return false;

    const rating = reaction.client.suggestions.getMessageRating(reaction.message)
    const { upVotes, downVotes } = rating

    if ((downVotes/upVotes) > voteConst) return onUnpopularSuggestion(reaction.client, reaction.message, suggestion, rating);
    if ((upVotes/downVotes) > voteConst) return onPopularSuggestion(reaction.client, reaction.message, suggestion, rating);

    const ratio = (upVotes > downVotes) ? (upVotes / downVotes) : -(downVotes / upVotes)
    const hue = (ratio === -1) ? (maxHue/2) : (ratio * ((maxHue/2) / voteConst)) + (maxHue/2)

    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(hue, suggestion)
    
    await reaction.message.edit({ embeds: [embed] })
    
}

async function onUnpopularSuggestion(client, message, suggestion, rating) {

    if (suggestion.epic) return false;

    const context = { 

        guild_id: message.guild.id,
        executor_id: client.user.id,
        suggestion: suggestion.toJSON()

    }

    // Remove from cache so that when the message delete event arrives it will not trigger anything
    const removed = client.database.suggestions.cache.remove(suggestion.id_suggestion)

    const response = await message.delete().then(() => true).catch(error => error)
    if (response !== true) {

        // Deleting the message failed so add the suggestion back to cache
        client.database.suggestions.cache.push(removed)

        await client.suggestions.logError(`Failed to remove suggestion after it getting ${rating.downVotes} down vote(s).`, { context, error: response })
        return false;

    }
    
    await client.suggestions.logError(`Removed a suggestion because of it getting **${rating.downVotes}** \`down vote(s)\` with only **${rating.upVotes}** \`up vote(s)\`.`, context)

    await client.database.suggestions.remove({ id_suggestion: suggestion.id_suggestion })
        .catch(error => console.error(`Unable to remove suggestion from database because of ${error}!`, suggestion))

}

async function onPopularSuggestion(client, message, suggestion, rating) {
    
    const { upVotes, downVotes } = rating
    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(-1, suggestion)
        
    // if (!message.pinned) await message.pin().catch(console.error)
    await message.edit({ embeds: [embed] }).catch(console.error)

    if (suggestion.epic) return false;
    
    await client.database.suggestions.update({ id_suggestion: suggestion.id_suggestion }, { epic: Math.round(Date.now()/1000) })

    const [suggestionUpVote, suggestionDownVote] = client.suggestions.getVoteEmojis(message.guild)

    const epicEmbed = embed.setFooter({ text: `Suggested in #${message.channel.name}` }).setTimestamp(suggestion.creation)
    const voteStatus = `**${upVotes-1}** ${suggestionUpVote}   **${downVotes-1}** ${suggestionDownVote}`
    await client.suggestions.sendEpicSuggestion(message.guild, epicEmbed, voteStatus)
    
}


module.exports = onReactionUpdate;