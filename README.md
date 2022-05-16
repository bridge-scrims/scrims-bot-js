# Javascript Scrims Discord Bot

>This is a bot made for the **bridge scrims discord server** (https://discord.gg/ZNBkRBjd8k).
It includes many features to enhance the user and staff experience aslong as the overall server efficiency.

## Scrims Events

The [**ScrimsBot**](https://github.com/bridge-scrims/scrims-bot-js/blob/main/src/lib/bot.js) discord client expands the current discord.js [Client](https://discord.js.org/#/docs/discord.js/stable/class/Client) event system by emiting scrims events. The MessageComponentInteraction/CommandInteraction/ModalSubmitInteraction go through a permission validation system that can completely handle an Interaction if it is not permitted. Any InteractEvent (Message, Interaction, ...) with a user paramenter will gain a scrimsUser parameter. Messages and MessageReactions will only check the cache, and other InteractEvents (like Interactions) will fetch the user and even create the scrimsUser (The scrimsUser always could be null thoe). Scrims events will always fetch partials.

- scrimsModalSubmit/scrimsInteractionCreate (permissions checked)
- scrimsMessageCreate/scrimsChannelCreate (with scrimsUser parameter)
- scrimsReactionAdd/scrimsReactionRemove (with a [MessageReaction](https://discord.js.org/#/docs/discord.js/stable/class/MessageReaction) given a user/scrimsUser parameter)
- scrimsMessageDelete/scrimsChannelDelete (where the Message/Channel could have a executor parameter from the audit log)

#### CUSTOM IDS

Are split up by `/` into multiple (case sensitive) arguments the first one is always removed and used to find the handler and the rest are saved in a **String[]** as `interaction.args`.

#### Application Commands

Commands can be declared in the [**CommandInstaller**](https://github.com/bridge-scrims/scrims-bot-js/blob/main/src/lib/commands.js) with the add method. After bot login the application commands are added if they don't exist and edited if they are different. The defaultPermission option is automatically set based off the commandPermissionData. If there is any guild where nobody would be allowed to use the command (position roles not setup) then defaultPermission is set to true and the permissions will just get handled bot client side.

#### PERMISSION SYSTEM

The permission system [**ScrimsPermissionsClient**](https://github.com/bridge-scrims/scrims-bot-js/blob/main/src/lib/permissions.js) is responsible for deciding if a [**GuildMember**](https://discord.js.org/#/docs/discord.js/stable/class/GuildMember) has a bridge scrims position. 

## Ticket System

>Using private channels for each support ticket and components for user input, this system aims to make requesting and handling support easier for both the support team and the discord server members.

The **Support Button** allows users to create a ticket using a modal with a textinputcomponent to give their reason.  Once submited, aslong as the user does not already have another ticket open, a new **ticket** will be created.

**Tickets** are saved in the table **ticket** with `id`, `userId` and `channelId` values.
Ticket channels are only viewable by the ticket creator and the support/staff team and are removed once the ticket was closed.

With permission of the ticket creator tickets can be closed with the **/close** command.
The staff team also has the option to forably close tickets with the **/forceclose** command.

While a ticket is open all activity will get saved using the **ticket-transcriber**.
Each message is added to the table **message** with `id`, `ticketId`, `content`, `creation`, `author` and `authorTag` values.
Once a ticket is closed the full transcript is sent to the ticket creator and into the configured transcription channel.
During this process the messages belonging to the ticket are also removed from the **message** table.


## Suggestion Feature

>This allows Discord server members to make suggestions for the server in an orderly and manageable way.

The configured **suggestions channel** will keep a info message at the bottom of the channel explaining how to suggest something.
With the **suggest button** members can describe their suggestions and send it for it to be voted.
Members can delete their own suggestions by right clicking on the message and clicking on `Apps` -> `Remove Suggestion`.

All suggestions are saved in the table **suggestion** and are removed if the message is deleted.

## Dependencies

Following packages are required for the bot to run:
 - [@discordjs/builders](https://discord.js.org/#/docs/builders/stable/general/welcome) Used to create application commands
 - [discord.js](https://discord.js.org/#/docs/discord.js/stable/general/welcome) Used to interact with the [Discord API](https://discord.com/developers/docs/intro)
 - [moment-timezone](https://momentjs.com/timezone/) Parse and display dates in any timezone
 - [got](https://github.com/sindresorhus/got#readme) Used to make async HTTP requests
 - [pg](https://github.com/brianc/node-postgres#readme) Used to communicate with the bridge scrims PostgreSQL server
 - [pg-ipc](https://github.com/emilbayes/pg-ipc#readme) For using IPC over PostgreSQL
 - [pg-pool](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool#readme) A connection pool for node-postgres

## Contributing

This code is maintained by the `developers of the bridge scrims discord server`.
If you found a problem feel free to create an issue, but also be sure to be exact with the description of your problem.
When commiting to the project, please be sure to update the documentation when necessary.


## License

This software does not contain a license, that means the creators of the software have given no permission to use, modify, or share the software for any purpose.
