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
const PositionsResponseMessageBuilder = require("./responses");

const positionRolesCommandHandler = require("./position_roles_command");
const ScrimsUserPosition = require("../lib/scrims/user_position");
const positionsCommandHandler = require("./positions_command");

const commandHandlers = { 

    "positions": positionsCommandHandler, 
    "position-roles": positionRolesCommandHandler,
    "PositionRoles": positionRolesCommandHandler,
    "scrims-sync-members": syncMembersCommandHandler,
    "SyncMembers": onSyncMembersComponent

}

/** @param {import("../types").ScrimsAutoCompleteInteraction} interaction */
async function getUserPositions(interaction, userId) {

    if (interaction.options.getSubcommand() === "give") return [];

    if (userId) {

        const userPositions = await interaction.client.database.userPositions.fetch({ user: { discord_id: userId } }, false)
            .catch(error => console.error(`Unable to get user positions for autocomplete because of ${error}!`))
        
        if (!userPositions) return [];
        return userPositions.sort(ScrimsUserPosition.sortByLevel);

    }

    return [];

}

/** @param {import("../types").ScrimsAutoCompleteInteraction} interaction */
async function onPositionAutoComplete(interaction) {

    const focused = interaction.options.getFocused().toLowerCase()
    const userId = interaction.options.get("user")?.value
    const userPositions = await getUserPositions(interaction, userId)

    if (interaction.options.getSubcommand() === "take") {
    
        return interaction.respond(
            userPositions
                .filter(userPos => userPos.position.name.toLowerCase().includes(focused))
                .map(userPos => ({ name: userPos.position.name, value: userPos.position.id_position }))
                .slice(0, 25)
        );

    }
    
    const positions = interaction.client.database.positions.cache.values()

    await interaction.respond(
        positions
            .filter(position => position.name.toLowerCase().includes(focused))
            .filter(position => !userPositions.find(userPos => userPos.id_position === position.id_position))
            .map(position => ({ name: position.name, value: position.id_position }))
            .slice(0, 25)
    )

}

/** @param {import("../types").ScrimsInteraction} interaction */
async function onInteraction(interaction) {

    if (interaction.isAutocomplete()) return onPositionAutoComplete(interaction);

    const commandHandler = commandHandlers[interaction.commandName]
    if (commandHandler) return commandHandler(interaction);
     
    throw new Error(`Interaction with name '${interaction.commandName}' does not have a handler!`, commandHandlers);

}

/** @param {import("../types").ScrimsCommandInteraction} interaction */
async function syncMembersCommandHandler(interaction) {

    const memberChanges = await interaction.client.positions.getMembersRolesDifference(interaction.guild).catch(error => error)
    if (memberChanges instanceof Error) {

        console.error(`Unable to get the member discord role differences!`, memberChanges)
        return interaction.editReply(PositionsResponseMessageBuilder.failedMessage(`get the member discord role differences`));

    }

    const wrongRoles = memberChanges.map(([ _, v ]) => v).flat().length
    const newRoles = memberChanges.map(([ v, _ ]) => v).flat().length

    const message = `Are you sure you want to do this? This will remove **${wrongRoles}**\`incorrect discord roles\``
        + ` and add **${newRoles}**\`new discord roles\`!`

    const actions = new MessageActionRow()
        .addComponents( 
            new MessageButton().setLabel("Confirm").setStyle(3).setCustomId(`SyncMembers/CONFIRM`),
            PositionsResponseMessageBuilder.cancelButton(interaction.i18n)
        )

    await interaction.editReply({ content: message, components: [ actions ], ephemeral: true })

}

/** @param {import("../types").ScrimsComponentInteraction} interaction */
async function onSyncMembersComponent(interaction) {

    if (interaction.args.shift() !== "CONFIRM") return false;

    if (!interaction.scrimsUser) return interaction.reply(PositionsResponseMessageBuilder.scrimsUserNeededMessage(interaction.i18n));

    await interaction.update({ content: `Syncing...`, embeds: [], components: [] })

    const result = await interaction.client.positions.syncPositions(interaction.guild).catch(error => error)
    if (result instanceof Error) {

        console.error(`Sync failed!`, result)
        return interaction.editReply(PositionsResponseMessageBuilder.failedMessage(`transfer the user positions`));

    }

    const [ removed, added ] = result
    
    const content = `**${removed.filter(v => v === true).length}/${removed.length}** \`removed\` successfully and `
        + `**${added.filter(v => v === true).length}/${added.length}** \`added\` successfully`

    await interaction.editReply({ content, embeds: [], components: [], ephemeral: true })
        .catch(() => {/* This could take more then 15 minutes, making the interaction token expire. */})

}

function getUserOption(description) {

    return new SlashCommandUserOption()
        .setName("user")
        .setRequired(true)
        .setDescription(description)

}

function getPositionOption(description) {

    return new SlashCommandIntegerOption()
        .setName("position")
        .setDescription(description)
        .setAutocomplete(true)
        .setRequired(true)    

}

function getGuildOption() {

    return new SlashCommandStringOption()
        .setName("guild")
        .setDescription("The guild this command should effect.")
        .setRequired(false)    

}

function getRoleOption(description) {

    return new SlashCommandRoleOption()
        .setName("role")
        .setDescription(description)
        .setRequired(true)

}

function getPositionsGetSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("get")
        .setDescription("Get a users bridge scrims positions.")
        .addUserOption( getUserOption("The user to get the birdge scrims positions of.") )

}

function getPositionsGiveSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("give")
        .setDescription("Gives a user a bridge scrims position.")
        .addUserOption( getUserOption("The user to give the birdge scrims positions to.") )
        .addIntegerOption( getPositionOption("The birdge scrims positions to give the user.") )
        .addStringOption(option => (
            option
                .setName("expiration")
                .setDescription("The amount of time before this position should expire (e.g. 5d 2hours 1min)")
                .setRequired(false)
        ))

}

function getPositionsTakeSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("take")
        .setDescription("Takes away a bridge scrims position from a user.")
        .addUserOption( getUserOption("The user to take the birdge scrims positions from.") )
        .addIntegerOption( getPositionOption("The birdge scrims positions to remove from the user.") )

}

function getPositionsInfoSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("info")
        .setDescription("Get information about bridge scrims positions.")
        .addIntegerOption( getPositionOption("The birdge scrims positions to get information about.").setRequired(false) )

}

function getPositionRolesStatusSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("status")
        .setDescription("Shows the current servers position roles.")
        .addStringOption( getGuildOption() )

}

function getPositionRolesReloadSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("reload")
        .setDescription("Reloads all of the servers position roles.")

}


function getPositionRolesAddSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("add")
        .setDescription("Adds a role that is connected to a bridge scrims position.")
        .addRoleOption( getRoleOption("The role that should be connected to the position.") )
        .addIntegerOption( getPositionOption("The position that should be connected to the role.") )

}


function getPositionRolesRemoveSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("remove")
        .setDescription("Removes a role that is currently connected to a bridge scrims position.")
        .addRoleOption( getRoleOption("The role that should be disconnected from any scrims position roles.") )
        .addIntegerOption( getPositionOption("The position that should be disconnected from the role.").setRequired(false) )

}

function getPositionRolesCommandGroup() {

    const getPositionRolesCommandGroup = new SlashCommandSubcommandGroupBuilder()
        .setName("position-roles")
        .setDescription("Commands used to manage this servers position roles.")
        .addSubcommand( getPositionRolesStatusSubcommand() )
        .addSubcommand( getPositionRolesReloadSubcommand() )
        .addSubcommand( getPositionRolesAddSubcommand() )
        .addSubcommand( getPositionRolesRemoveSubcommand() )

    return [ getPositionRolesCommandGroup, { permissionLevel: "staff" }, { forceGuild: true, bypassBlock: false, forceScrimsUser: false } ];

}

function getPositionsCommandGroup() {

    const positionsCommandGroup = new SlashCommandSubcommandGroupBuilder()
        .setName("positions")
        .setDescription("Commands used to manage a users positions.")
        .addSubcommand( getPositionsGetSubcommand() )
        .addSubcommand( getPositionsGiveSubcommand() )
        .addSubcommand( getPositionsTakeSubcommand() )
        .addSubcommand( getPositionsInfoSubcommand() )

    return [ positionsCommandGroup, { permissionLevel: "support" }, { forceGuild: true, bypassBlock: false, forceScrimsUser: false } ];

}

function getBridgeScrimsSyncCommand() {

    const syncCommand = new SlashCommandBuilder()
        .setName("scrims-sync-members")
        .setDescription("Use this command to sync everyones bridge scrims position roles.")

    return [ syncCommand, { permissionLevel: "owner" }, { forceGuild: true, bypassBlock: false, forceScrimsUser: false, ephemeralDefer: true } ];

}

module.exports = {

    interactionHandler: onInteraction,
    eventListeners: [ "PositionRoles", "SyncMembers" ],
    commands: [ getPositionsCommandGroup(), getPositionRolesCommandGroup(), getBridgeScrimsSyncCommand() ]

};