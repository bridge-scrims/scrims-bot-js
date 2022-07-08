const { MessageActionRow, MessageButton } = require("discord.js");
const MemoryMessageButton = require("../lib/components/memory_button");
const ScrimsMessageBuilder = require("../lib/responses");
const I18n = require("../lib/tools/internationalization");

class MinecraftMessageBuilder extends ScrimsMessageBuilder {
    /**
     * @param {I18n} i18n
     */
    static connectAccountEmbed(i18n) {
        return i18n.getEmbed("minecraft_connect_account_embed");
    }

    /**
     * @param {I18n} i18n
     */
    static connectAccountActions(i18n) {
        return new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId("minecraft/connectAccount/start")
                .setLabel(i18n.get("minecraft_connect_account_button"))
                .setEmoji("<:minecraft:994567314232061963>")
                .setStyle(1)
        );
    }

    /**
     * @param { I18n } i18n
     */
    static connectAccountMessage(i18n) {
        return {
            embeds: [this.connectAccountEmbed(i18n)],
            components: [this.connectAccountActions(i18n)],
        };
    }

    /**
     * @param { I18n } i18n
     * @param { string } customId
     */
    static confirmCancelActionRow(i18n, customId) {
        return new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(customId + "/cancel")
                .setLabel(i18n.get("cancel"))
                .setEmoji("❌")
                .setStyle(4),
            new MessageButton()
                .setCustomId(customId + "/confirm")
                .setLabel(i18n.get("confirm"))
                .setEmoji("✅")
                .setStyle(3)
        );
    }

    /**
     * @param { I18n } i18n
     * @param { string } minecraft_name
     */
    static disconnectConfirmCancelMessage(i18n, minecraft_name) {
        return {
            content: i18n.get(
                "minecraft_connect_account_already_connected",
                minecraft_name
            ),
            components: [
                this.confirmCancelActionRow(
                    i18n,
                    "minecraft/disconnectAccount"
                ),
            ],
        };
    }

    static disconnectSuccessMessage(i18n) {
        return {
            content: i18n.get("minecraft_connect_account_disconnect_success"),
        };
    }
}

module.exports = MinecraftMessageBuilder;
