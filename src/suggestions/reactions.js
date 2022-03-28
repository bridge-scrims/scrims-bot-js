const SuggestionsResponseMessageBuilder = require('./responses');

const maxHue = 120

async function onReactionUpdate(reaction) {

    const voteConst = reaction.client.suggestions.voteConst
    const [suggestionUpVote, suggestionDownVote] = reaction.client.suggestions.getVoteEmojis(reaction.message.guild)
    
    const suggestionData = reaction.client.database.suggestions.cache.get({ message_id: reaction.message.id })[0]
    if (!suggestionData) return false;

    const upVotes = reaction.message.reactions.cache.get(suggestionUpVote.id ?? suggestionUpVote)?.count || 1;
    const downVotes = reaction.message.reactions.cache.get(suggestionDownVote.id ?? suggestionDownVote)?.count || 1;
    const suggestion = { ...suggestionData, upVotes, downVotes }

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

    await client.database.suggestions.remove({ id_suggestion: suggestion.id_suggestion }).catch(console.error)
    await message.delete();

}

async function onPopularSuggestion(client, message, suggestion) {

    const { upVotes, downVotes } = suggestion
    const embed = SuggestionsResponseMessageBuilder.suggestionEmbed(
        -1, suggestion.suggestion, suggestion.created_at*1000, client.users.resolve(suggestion.creator.discord_id)
    )
        
    await message.pin().catch(console.error)
    await message.edit({ embeds: [embed] }).catch(console.error)

    // Removing it from the database so that the user can not
    // delete it and so that the reaction events are ignored
    await client.database.suggestions.remove({ id_suggestion: suggestion.id_suggestion })

    const [suggestionUpVote, suggestionDownVote] = client.suggestions.getVoteEmojis(message.guild)

    const epicChannel = await message.guild.channels.fetch(client.suggestions.epicSuggestionsChannelId)
    if (epicChannel) {

        await epicChannel.send({ embeds: [embed.setFooter({ text: `Suggested in #${message.channel.name}` }).setTimestamp(suggestion.creation)] })
        await epicChannel.send({ content: `**${upVotes-1}** ${suggestionUpVote}   **${downVotes-1}** ${suggestionDownVote}` })
        
    }   
    
}


module.exports = onReactionUpdate;