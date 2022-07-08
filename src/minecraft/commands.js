const {
    SlashCommandSubcommandGroupBuilder,
    SlashCommandSubcommandBuilder,
    SlashCommandIntegerOption,
    SlashCommandStringOption,
    SlashCommandUserOption,
    SlashCommandRoleOption,
    SlashCommandBuilder,
} = require("@discordjs/builders");

const { MessageActionRow, MessageButton } = require("discord.js");
const MinecraftMessageBuilder = require("./responses");

const commandHandlers = {
    "connect-account-message": connectAccountMessage,
};

async function onCommand(interaction) {
    const handler = commandHandlers[interaction.commandName];
    if (handler) return handler(interaction);

    throw new Error(
        `Interaction with name '${interaction.commandName}' does not have a handler!`,
        commandHandlers
    );
}

/**
 * @param { import("../types").ScrimsCommandInteraction } interaction
 */
async function connectAccountMessage(interaction) {
    await interaction.channel.send(
        MinecraftMessageBuilder.connectAccountMessage(interaction.i18n)
    );
    await interaction.reply({
        content: interaction.i18n.get("success"),
        ephemeral: true,
    });
}

function buildConnectAccountMessage() {
    const connectAccountMessageCommand = new SlashCommandBuilder()
        .setName("connect-account-message")
        .setDescription("Sends the initial message for connecting accounts.");

    return [
        connectAccountMessageCommand,
        { positionLevel: "staff" },
        { forceGuild: true },
    ];
}

module.exports = {
    commandHandler: onCommand,
    commands: [buildConnectAccountMessage()],
};
