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
const positionsCommandHandler = require("./positions_command");

const commandHandlers = { 

    positions: positionsCommandHandler, 
    "position-roles": positionRolesCommandHandler,
    "PositionRoles": positionRolesCommandHandler,
    "scrims-sync-members": syncMembersCommandHandler

}

async function getUserPositions(interaction, userId) {

    if (interaction.options.getSubcommand() === "give") return [];

    if (userId) {

        const userPositions = await interaction.client.database.userPositions.get({ user: { discord_id: userId } }).catch(error => error)
        if (userPositions instanceof Error) {
    
            console.error(`Unable to get user positions for autocomplete because of ${userPositions}!`)
            return [];
    
        }
        return userPositions;

    }

    return [];

}

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
    
    const positions = await interaction.client.database.positions.get({ }).catch(error => error)
    if (positions instanceof Error) {

        console.error(`Unable to get positions for autocomplete because of ${positions}!`)
        return false;

    }

    await interaction.respond(
        positions
            .filter(position => position.name.toLowerCase().includes(focused))
            .filter(position => userPositions.filter(userPos => userPos.id_position == position.id_position).length === 0)
            .map(position => ({ name: position.name, value: position.id_position }))
            .slice(0, 25)
    )

}

async function onInteraction(interaction) {

    if (!interaction.guild)
        return interaction.reply(PositionsResponseMessageBuilder.errorMessage("Guild Only", "This should only be used in discord servers!"));

    if (interaction.isAutocomplete()) return onPositionAutoComplete(interaction);

    const commandHandler = commandHandlers[interaction.commandName]
    if (commandHandler) return commandHandler(interaction);
     
    await interaction.reply({ content: "How did we get here?", ephemeral: true });

}

async function membersInitialized(interaction) {

    const members = await interaction.guild.members.fetch()
    const scrimsMembers = await Promise.all(members.map(member => interaction.client.database.users.get({ discord_id: member.id })))
    return (scrimsMembers.every(scrimsMembers => scrimsMembers.length > 0));

}

function getNonInitializedErrorPayload() {

    return PositionsResponseMessageBuilder.errorMessage(
        `Not Ready`, `This servers members have not yet all been added to the scrims user database. Please try again later.`
    );

}

async function syncMembersCommandHandler(interaction) {

    if (!(await membersInitialized(interaction))) return interaction.reply( getNonInitializedErrorPayload() );

    await interaction.deferReply({ ephemeral: true })

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
            PositionsResponseMessageBuilder.cancelButton()
        )

    await interaction.editReply({ content: message, components: [ actions ], ephemeral: true })

}

function getUserOption(description) {

    return new SlashCommandUserOption()
        .setName("user")
        .setRequired(true)
        .setDescription(description)

}

function getPositionOption(description) {

    return new SlashCommandStringOption()
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
        .addStringOption( getPositionOption("The birdge scrims positions to give the user.") )
        .addIntegerOption(option => (
            option
                .setName("expiration")
                .setDescription("The number of hours before this position should expire.")
                .setRequired(false)
        ))

}

function getPositionsTakeSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("take")
        .setDescription("Takes away a bridge scrims position from a user.")
        .addUserOption( getUserOption("The user to take the birdge scrims positions from.") )
        .addStringOption( getPositionOption("The birdge scrims positions to remove from the user.") )

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
        .addStringOption( getPositionOption("The position that should be connected to the role.") )

}


function getPositionRolesRemoveSubcommand() {

    return new SlashCommandSubcommandBuilder()
        .setName("remove")
        .setDescription("Removes a role that is currently connected to a bridge scrims position.")
        .addRoleOption( getRoleOption("The role that should be disconnected from any scrims position roles.") )
        .addStringOption( getPositionOption("The position that should be disconnected from the role.").setRequired(false) )

}

function getPositionRolesCommandGroup() {

    const getPositionRolesCommandGroup = new SlashCommandSubcommandGroupBuilder()
        .setName("position-roles")
        .setDescription("Commands used to manage this servers position roles.")
        .addSubcommand( getPositionRolesStatusSubcommand() )
        .addSubcommand( getPositionRolesReloadSubcommand() )
        .addSubcommand( getPositionRolesAddSubcommand() )
        .addSubcommand( getPositionRolesRemoveSubcommand() )

    return [ getPositionRolesCommandGroup, { permissionLevel: "staff" } ];

}

function getPositionsCommandGroup() {

    const positionsCommandGroup = new SlashCommandSubcommandGroupBuilder()
        .setName("positions")
        .setDescription("Commands used to manage a users positions.")
        .addSubcommand( getPositionsGetSubcommand() )
        .addSubcommand( getPositionsGiveSubcommand() )
        .addSubcommand( getPositionsTakeSubcommand() )

    return [ positionsCommandGroup, { permissionLevel: "support" } ];

}

function getBridgeScrimsSyncCommand() {

    const syncCommand = new SlashCommandBuilder()
        .setName("scrims-sync-members")
        .setDescription("Use this command to sync everyones bridge scrims position roles.")

    return [ syncCommand, { permissionLevel: "staff" } ];

}

module.exports = {

    interactionHandler: onInteraction,
    eventListeners: [ "PositionRoles" ],
    commands: [ getPositionsCommandGroup(), getPositionRolesCommandGroup(), getBridgeScrimsSyncCommand() ]

};