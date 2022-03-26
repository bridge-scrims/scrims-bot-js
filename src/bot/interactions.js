const onCloseRequestComponent = require("../support/close-request-component.js");
const onSuggestionInteraction = require("../suggestions/interactions.js");
const onSupportComponent = require("../support/components.js");
const onForceCloseCommand = require("../support/forceclose-cmd.js");
const onSupportSubmit = require("../support/modals.js");
const onCloseCommand = require("../support/close-cmd.js");

const ResponseTemplates = require("./responses.js");

function getHandler(cmdName) {

    switch(cmdName) {
        case("TicketCloseRequest"): return onCloseRequestComponent;
        case("Remove Suggestion"): return onSuggestionInteraction;
        case("suggestion"): return onSuggestionInteraction;
        case("forceclose"): return onForceCloseCommand;
        case("support-modal"): return onSupportSubmit; 
        case("support"): return onSupportComponent;
        case("reload"): return onReloadCommand;
        case("close"): return onCloseCommand;
        default: return false;
    }

}

function expandInteraction(interaction) {
    interaction.userId = interaction.user.id
    interaction.params = interaction.options
    
    interaction.permissionLevel = interaction.client.commandPermissions[interaction.commandId] ?? null
    if (interaction.member)
        interaction.member.hasPermission = (permLevel) => interaction.client.hasPermission(interaction.member, permLevel)
    
    interaction.args = interaction?.customId?.split("/") || []
    if (!interaction.commandName) 
        interaction.commandName = interaction.args.shift() || null
}

function isPermitted(interaction) {
    if (!(interaction.member)) return true;
    if (!(interaction.permissionLevel)) return true;
    return interaction.member.hasPermission(interaction.permissionLevel);
}

async function handleInteraction(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: "This command must be used inside of discord servers!" });

    expandInteraction(interaction)
    if (!isPermitted(interaction)) return interaction.reply(getMissingPermissionPayload());

    const handler = getHandler(interaction.commandName);
    if (!handler) console.warn(`Rejected an interaction without a handler (${interaction.commandName})!`)
    if (!handler) return interaction.reply({ content: "This command does not have a handler. Please refrain from trying again.", ephemeral: true });

	return handler(interaction).catch(console.error);
}

function getMissingPermissionPayload() {
    return ResponseTemplates.errorMessage("Insufficient Permissions", "You are missing the required permissions to use this command!");
}



module.exports = handleInteraction;