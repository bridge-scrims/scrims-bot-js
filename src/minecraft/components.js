const MinecraftMessageBuilder = require("./responses");

const componentHandlers = {
    
};

/**
 * @param { import('../types').ScrimsComponentInteraction | import('../types').ScrimsModalSubmitInteraction } interaction
 */
async function onComponent(interaction) {
    const handler = componentHandlers[interaction.args.shift()];
    if (handler) {
        if (!interaction.guild)
            return interaction.reply(
                SupportResponseMessageBuilder.guildOnlyMessage(interaction.i18n)
            );

        return handler(interaction);
    }
}

module.exports = onComponent;
