# Javascript Scrims Discord Bot

>This is a bot made for the **bridge scrims discord server** (https://discord.gg/ZNBkRBjd8k).
It includes many features to enhance the user and staff experience aslong as the overall efficiency.

## Ticket System

>Using private channels for each support ticket and components for user input, this system aims to make requesting and handling support easier for both the support team and the discord server members.

The **Support Button** creates a modal with a textinputcomponent for users to type in their reason for requesting support.  Once submited (aslong as the user does not have another ticket open) a new **ticket** will be created.

**Tickets** are saved in a database with a `id`, `userId` and a `channelId`.
Ticket channels are only viewable by the ticket creator and the support team and are removed once the ticket was closed.

With permission of the ticket creator tickets can be closed with the **/close** command.
The support team also has the option to forably close tickets with the **/forceclose** command.

While a ticket is open all activity will get saved using the **ticket-transcriber**.
Once a ticket is closed the full transcription is sent to the ticket creator and into the configured transcription channel.

## TODO

- [ ] Post transcriptions to website from viewing (since its hard to display a lot of data using discord)
- [ ] Add the following tasks:
 - All users with both member and unverified role will remove unverified
 - All users with banned and member role will remove member
 - All users with banned and unverified will remove unverified
 - All users without the booster role will lose all the following roles

## Contributing

Changes to this code are limited to the `developers of the bridge scrims discord server`.
During commits please make sure to update the documentation when necessary.

## License

This code is **private** and should not be distributed to anyone but the `developers of the bridge scrims discord server`.