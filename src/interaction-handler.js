const onCloseRequestComponent = require("./user-handlers/close-request-component.js");
const onSupportComponent = require("./user-handlers/support-component.js");
const onForceCloseCommand = require("./user-handlers/forceclose-cmd.js");
const onSupportSubmit = require("./user-handlers/support-modal.js");
const onCloseCommand = require("./user-handlers/close-cmd.js");

function getHandler(cmdName) {

    switch(cmdName) {
        case("TicketCloseRequest"): return onCloseRequestComponent;
        case("forceclose"): return onForceCloseCommand;
        case("support-modal"): return onSupportSubmit; 
        case("support"): return onSupportComponent;
        case("close"): return onCloseCommand;
        default: return false;
    }

}

function expandInteraction(interaction) {
    interaction.userId = interaction.user.id
    interaction.params = interaction.options
    interaction.hasPermission = (permLevel) => interaction.client.hasPermission(interaction?.member, permLevel)
    interaction.args = interaction?.customId?.split("/") || []
    if (!interaction.commandName) 
        interaction.commandName = interaction.args.shift() || null
}

async function handleInteraction(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "This command must be used inside of discord servers!" });

    expandInteraction(interaction)
    const handler = getHandler(interaction.commandName);
    if (!handler) console.warn(`Rejected an interaction without a handler (${interaction.commandName})!`)
    if (!handler) return interaction.reply({ content: "This command does not have a handler. Please refrain from trying again.", ephemeral: true });

	return handler(interaction).catch(console.error);
}

module.exports = handleInteraction;