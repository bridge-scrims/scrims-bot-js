# Javascript Scrims Discord Bot

>This is a bot made for the **bridge scrims discord server** (https://discord.gg/ZNBkRBjd8k).
It includes many features to enhance the user and staff experience aslong as the overall server efficiency.



## Interaction Handling

>All [**Application Command Objects**](https://discord.com/developers/docs/interactions/application-commands#application-command-object) saved in `/src/assets/commands.json` are added to guilds as [**Guild Application Commands**](https://discord.com/developers/docs/interactions/application-commands#create-guild-application-command) via the [**GuildApplicationCommandManager**](https://discord.js.org/#/docs/discord.js/stable/class/GuildApplicationCommandManager) on runtime.
The main interaction handler is located at `/src/interaction-handler.js` where the function **getHandler** resolves the command name or customId's fisrt argument to a command specific handler that are located in `/src/user-handlers`.


#### CUSTOM IDS

Are split up by `/` into multiple (case sensitive) arguments the first one is always removed and used to find the handler (`/src/interaction-handler` -> **getHandler**) and the rest are saved in a **String[]** as `interaction.args`.



#### PERMISSION SYSTEM

The permission system is responsible for deciding if a [**GuildMember**](https://discord.js.org/#/docs/discord.js/stable/class/GuildMember) has the required permissions to execute a [**Application Command**](https://discord.js.org/#/docs/discord.js/stable/class/ApplicationCommand) or a [**Message Component**](https://discord.js.org/#/docs/discord.js/stable/typedef/MessageComponent).
To represent permissions **permission levels** are used. To check if a [**GuildMember**](https://discord.js.org/#/docs/discord.js/stable/class/GuildMember) has a **permission level** the `/src/bot.js` -> **hasPermission** function is used. When a interaction is created the member will also get the **hasPermission** function, meaning that u could call **interaction.member.hasPermission(permissionLevel)**.

Each command in `/src/assets/commands.json` can also have a **permissionLevel** value.
Once this command was executed if the [**GuildMember**](https://discord.js.org/#/docs/discord.js/stable/class/GuildMember) who requested this command does not have the set **permissionLevel**, the bot will reply with the **missing permissions embed** located in `/src/interaction-handler.js`.


### <a id="adding-permission-level" class="anchor"></a>ADDING A PERMISSION LEVEL

To do this you would just need to modify the `/src/bot.js` -> **hasPermission** function to support your permissionLevel.


### ADDING A COMMAND CHECKLIST

1. add the command to `/src/assets/commands.json` following the [**Application Command Object**](https://discord.com/developers/docs/interactions/application-commands#application-command-object) structure
2. add a command handler file to `/src/user-handlers` that exports a function that takes a **interaction** as a first argument
3. require your new file in `/src/interaction-handler.js` and add to the **getHandler** function
4. if needed add any new permission levels like [this](#adding-permission-level)


### ADDING A COMPONENT

>Same as adding a command except you don't add it to `/src/assets/commands.json`. 

See the `CUSTOM IDS` portion for setting the components customId.



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


## Dependencies

Following packages are required for the bot to run:
 - [discord.js](https://discord.js.org/#/) Used to interact with the [Discord API](https://discord.com/developers/docs/intro) 
 - [discord-modals](https://github.com/Mateo-tem/discord-modals#readme) At least until discord.js supports modals
 - [mysql2](https://github.com/sidorares/node-mysql2#readme) Used to read and write data to and from the Bridge Scrims Mysql Database


## TODO

- [ ] Add /give command to be used by the council heads for giving prime, private and premium roles
- [ ] Post transcripts to website for better view ability (since its hard to display a lot of data using discord)
- [ ] Complete the following tasks:
 - All users with both member and unverified role will remove unverified
 - All users with banned and member role will remove member
 - All users with banned and unverified will remove unverified
 - All users without the booster role will lose all the following roles


## Contributing

This code is maintained by the `developers of the bridge scrims discord server`.
If you found a problem feel free to create an issue, but also be sure to be exact with the description of your problem.
When commiting to the project, please be sure to update the documentation when necessary.


## License

This software does not contain a license, that means the creators of the software have given no permission to use, modify, or share the software for any purpose.
