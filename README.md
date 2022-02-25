# Javascript Scrims Discord Bot

>This is a bot made for the **bridge scrims discord server** (https://discord.gg/ZNBkRBjd8k).
It includes many features to enhance the user and staff experience aslong as the overall server efficiency.

## Ticket System

>Using private channels for each support ticket and components for user input, this system aims to make requesting and handling support easier for both the support team and the discord server members.

The **Support Button** creates a modal with a textinputcomponent for users to type in their reason for requesting support.  Once submited (aslong as the user does not have another ticket open) a new **ticket** will be created.

**Tickets** are saved in the table **tickets** with `id`, `userId` and `channelId` values.
Ticket channels are only viewable by the ticket creator and the support/staff team and are removed once the ticket was closed.

With permission of the ticket creator tickets can be closed with the **/close** command.
The staff team also has the option to forably close tickets with the **/forceclose** command.

While a ticket is open all activity will get saved using the **ticket-transcriber**.
Each message is added to the table **transcript** with `id`, `ticketId`, `content`, `creation`, `author` and `authorTag` values.
Once a ticket is closed the full transcript is sent to the ticket creator and into the configured transcription channel.
The messages belonging to the ticket are also removed from the **transcript** table.

## TODO

- [ ] Post transcripts to website for better view ability (since its hard to display a lot of data using discord)
- [ ] Complete the following tasks:
 - All users with both member and unverified role will remove unverified
 - All users with banned and member role will remove member
 - All users with banned and unverified will remove unverified
 - All users without the booster role will lose all the following roles

## Contributing

Changes to this code are limited to the `developers of the bridge scrims discord server`.
During commits please make sure to update the documentation when necessary.

## License

This code is **private** and should not be distributed to anyone but the `developers of the bridge scrims discord server`.
