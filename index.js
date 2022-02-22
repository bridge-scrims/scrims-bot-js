const Discord = require("discord.js");

const mysql = require("mysql");

// Get prefix + token from config.json
const { prefix, token, host, username, password, database } = require("./config.json");

const fs = require("fs");

const client = new Discord.Client({
  intents: [
    "GUILD_MEMBERS",
    "GUILDS",
    "GUILD_MESSAGES",
    "GUILD_VOICE_STATES",
    "GUILD_MESSAGE_REACTIONS",
  ],
});

// MessageAttachment
const { MessageAttachment } = require("discord.js");

// setTimeout
const wait = require("util").promisify(setTimeout);

// Buttons, actions, etc. For latest version of Discord.JS.
const { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } = require("discord.js");

const { Modal, TextInputComponent, showModal } = require('discord-modals');
const discordModals = require('discord-modals');
discordModals(client);

let transcriptChannel = "";

// When the bot starts up.
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

var con = mysql.createPool({
  connectionLimit: 100,
  host: host,
  user: username,
  password: password,
  database: database,
  debug: false,
});

client.on('modalSubmit', async (interaction) => {
  if (interaction.customId === 'support') {
    const firstResponse = interaction.getTextInputValue('support');
    await interaction.deferReply({ ephemeral: true });
    con.query(`SELECT * FROM tickets WHERE id='${interaction.member.id}'`, async (err, rows) => {
      if (err) throw err;
      if (rows.length < 1) {
        let title = "support-" + interaction.user.username.toLowerCase();

        interaction.guild.channels.create(title, {
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
              deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"], //Deny permissions
            },
            {
              // But allow the two users to view the channel, send messages, and read the message history.
              id: interaction.user.id,
              allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"],
            },
          ],
        }).then(async(channel) => {
          con.query(`INSERT INTO tickets (channelid, id) VALUES ('${channel.id}', '${interaction.member.id}')`, async (err, rows) => {
            if (err) throw err;
            const createdEmbed = new Discord.MessageEmbed()
              .setColor("#83cf5d")
              .setTitle(`Created Ticket`)
              .setDescription("Opened a new ticket: <#" + channel.id + ">")
              .setTimestamp();
            const channelEmbed = new Discord.MessageEmbed()
              .setColor("#5d9acf")
              .setTitle(`Support`)
              .setDescription("Thank you for opening a support ticket on Ranked Bridge! If there is any way that we can assist you, please state it below and we will be glad to help! Regarding Staff/Scorer applications, Staff will send you a Google Document for you to fill out. We are working on automating the process for applications, so please be patient as we work on developing that!\n`Reason:`\n```" + firstResponse + "```")
              .setTimestamp();
            await interaction.followUp({ embeds: [createdEmbed] });
            await interaction.guild.channels.cache.get(channel.id).send({ embeds: [channelEmbed] });
          });
        });
      } else {
        let channelThing = interaction.guild.channels.cache.find((c) => c.name === "support-" + interaction.user.username.toLowerCase());
        if (!channelThing) {
          con.query(`DELETE FROM tickets WHERE id='${rows[0].id}'`, async (erre, rowse) => {
            if (erre) throw erre;
            let title = "support-" + interaction.user.username.toLowerCase();

            interaction.guild.channels.create(title, {
              permissionOverwrites: [
                {
                  id: interaction.guild.roles.everyone, //To make it be seen by a certain role, user an ID instead
                  deny: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"], //Deny permissions
                },
                {
                  // But allow the two users to view the channel, send messages, and read the message history.
                  id: interaction.user.id,
                  allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"],
                },
                {
                  // But allow the two users to view the channel, send messages, and read the message history.
                  id: "877309777741500487",
                  allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "SEND_MESSAGES"],
                },
              ],
            }).then(async(channel) => {
              con.query(`INSERT INTO tickets (channelid, id) VALUES ('${channel.id}', '${interaction.member.id}')`, async (err, rows) => {
                if (err) throw err;
                const createdEmbed = new Discord.MessageEmbed()
                  .setColor("#83cf5d")
                  .setTitle(`Created Ticket`)
                  .setDescription("Opened a new ticket: <#" + channel.id + ">")
                  .setTimestamp();
                const channelEmbed = new Discord.MessageEmbed()
                  .setColor("#5d9acf")
                  .setTitle(`Support`)
                  .setDescription("Thank you for opening a support ticket with Bridge Scrims! If there is any way that we can assist you, please state it below and we will be glad to help!\n`Reason:`\n```" + firstResponse + "```")
                  .setTimestamp();
                await interaction.followUp({ embeds: [createdEmbed] });
                await interaction.guild.channels.cache.get(channel.id).send({ embeds: [channelEmbed] });
              });
            });
          });
        } else {
          const channelEmbed = new Discord.MessageEmbed()
            .setColor("#2f3136")
            .setTitle(`Error!`)
            .setDescription("You already have a ticket open (<#" + channelThing.id + ">).")
            .setTimestamp();
          await interaction.editReply({ embeds: [channelEmbed] });
        }
      }
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "forceclose") {
      if (!interaction.member.roles.cache.some((r) => r.name === "Support")) {
        const notSetEmbed = new Discord.MessageEmbed()
          .setColor("#ff2445")
          .setTitle("You don't have permission to use this command!")
          .setTimestamp();
        // Send the embd.
        await interaction.reply(({ embeds: [notSetEmbed], files: [file] }));
        return;
      } else {
        con.query(`SELECT * FROM tickets WHERE channelid='${interaction.channel.id}'`, async (err, rows) => {
          if (err) throw err;
          if (rows.length < 1) {
            const embed = new Discord.MessageEmbed()
              .setColor("#ff2445")
              .setTitle("Error!")
              .setDescription("This isn't a ticket channel!")
              .setTimestamp();
            await interaction.reply({ embeds: [embed] });
          } else {
            con.query(`DELETE FROM tickets WHERE id='${rows[0].id}'`, async (erre, rowse) => {
              if (erre) throw erre;
              interaction.channel.delete();
            });
          }
        });
      }
    }
    if (interaction.commandName === "close") {
      if (!interaction.member.roles.cache.some((r) => r.name === "Support")) {
        const notSetEmbed = new Discord.MessageEmbed()
          .setColor("#ff2445")
          .setTitle("You don't have permission to use this command!")
          .setTimestamp();
        // Send the embd.
        await interaction.reply(({ embeds: [notSetEmbed], files: [file] }));
        return;
      } else {
        if (interaction.options.getSubcommand() === 'reason') {
          const reasonSome = interaction.options.getString('reason');
          let reason;
          if (!reasonSome) {
            reason = "No reason provided.";
          } else {
            reason = reasonSome;
          }
          con.query(`SELECT * FROM tickets WHERE channelid='${interaction.channel.id}'`, async (err, rows) => {
            if (err) throw err;
            if (rows.length < 1) {
              const embed = new Discord.MessageEmbed()
                .setColor("#ff2445")
                .setTitle("Error!")
                .setDescription("This isn't a ticket channel!")
                .setTimestamp();
              await interaction.reply({ embeds: [embed] });
            } else {
              const closeButton = new MessageActionRow().addComponents(
                new MessageButton()
                  .setCustomId("deny-" + rows[0].id)
                  .setLabel("❌ Deny & Keep Open")
                  .setStyle("PRIMARY")
              );
              const openButton = new MessageActionRow().addComponents(
                new MessageButton()
                  .setCustomId("accept-" + rows[0].id)
                  .setLabel("✅ Accept & Close")
                  .setStyle("PRIMARY")
              );
              const embed = new Discord.MessageEmbed()
                .setColor("#5d9acf")
                .setTitle("Close Request")
                .setDescription("<@" + interaction.member.id + "> has requested to close this ticket. Reason:\n```" + reason + "```\nPlease accept or deny using the buttons below.")
                .setTimestamp();
              await interaction.reply("<@" + rows[0].id + ">");
              await interaction.channel.send({ embeds: [embed], components: [openButton, closeButton] });
            }
          });
        }
      }
    }
  }
  if (interaction.isButton()) {
    if (interaction.customId.includes("deny")) {
      await interaction.deferReply({ ephemeral: true });
      let splitID = interaction.customId.split("-");
      let userID = splitID[1];
      if (userID != interaction.member.id) {
        const errorEmbed = new Discord.MessageEmbed()
          .setColor("#2f3136")
          .setTitle(`Error!`)
          .setDescription("Only <@" + userID + "> can close this ticket. If you are Staff, use `/forceclose`.")
          .setTimestamp();
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        transcribe(interaction.channel.id, "<b>" + interaction.member.user.username + "</b> denied the close request.");
        await interaction.editReply("Denied close request.");
        const embed = new Discord.MessageEmbed()
          .setColor("#ff2445")
          .setTitle(`Close Request Denied`)
          .setDescription("<@" + interaction.member.id + "> has denied the close request.")
          .setTimestamp();
        interaction.message.edit({ embeds: [embed], components: [] });
      }
    }
    if (interaction.customId === "support") {
      const modal = new Modal() // We create a Modal
      .setCustomId('support')
      .setTitle('Support Ticket')
      .addComponents(
        new TextInputComponent() // We create an Text Input Component
        .setCustomId('support')
        .setLabel('Reason for opening a ticket')
        .setStyle('LONG') //IMPORTANT: Text Input Component Style can be 'SHORT' or 'LONG'
        .setMinLength(5)
        .setMaxLength(2000)
        .setPlaceholder('Write here')
        .setRequired(true) // If it's required or not
        .setValue('value')
      );
      showModal(modal, {
        client: client, // The showModal() method needs the client to send the modal through the API.
        interaction: interaction // The showModal() method needs the interaction to send the modal with the Interaction ID & Token.
      })
    }

    if (interaction.customId.includes("accept")) {
      await interaction.deferReply({ ephemeral: true });
      let splitID = interaction.customId.split("-");
      let userID = splitID[1];
      if (userID != interaction.member.id) {
        const channelEmbed = new Discord.MessageEmbed()
          .setColor("#2f3136")
          .setTitle(`Error!`)
          .setDescription("Only <@" + userID + "> can close this ticket. If you are Staff, use `/forceclose`.")
          .setTimestamp();
        await interaction.editReply({ embeds: [channelEmbed] });
      } else {
        con.query(`SELECT * FROM tickets WHERE channelid='${interaction.channel.id}'`, async (err, rows) => {
          if (err) throw err;
          if (rows.length < 1) {
            const embed = new Discord.MessageEmbed()
              .setColor("#2f3136")
              .setTitle("Error!")
              .setDescription("This isn't a ticket channel!")
              .setTimestamp();
            await interaction.reply({ embeds: [embed] });
          } else {
            transcribe(interaction.channel.id, "<b>" + interaction.member.user.username + "</b> accepted the close request.");
            const cName = interaction.channel.name;
            let splitThing = cName.split("-");
            const idThing = rows[0].id;
            sendTranscription(interaction, interaction.channel.id, splitThing[1], idThing);
            con.query(`DELETE FROM tickets WHERE id='${interaction.member.id}'`, async (err, rows) => {
              if (err) throw err;
            });
            interaction.channel.delete();
          }
        });
      }
    }
  }
});

client.on("messageCreate", async (message) => {
  // Argument related.
  const args = message.content.trim().split(/ +/g);
  const cmd = args[0].slice().toLowerCase();

  if (message.channel.name.includes("support") && message.author.id != "877315883859603466") {
    transcribe(message.channel.id, "<b>" + message.author.username + ":</b> " + message.content);
  }

  if (message.content === `${prefix}ticketembed`) {
    const button = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("support")
        .setLabel("✉️ Support")
        .setStyle("PRIMARY")
    );
    const embed = new Discord.MessageEmbed()
      .setColor("#5d9acf")
      .setTitle("Bridge Scrims Support")
      .setDescription("If you do not state your issue within 5 minutes of creating your ticket, it will be closed.")
      .setTimestamp();
    message.channel.send({ embeds: [embed], components: [button] });
  }
});

function transcribe(fileName, message) {
  var fs = require("fs");
  var util = require("util");
  var logFile = fs.createWriteStream("../tickets/" + fileName + ".txt", { flags: "a" });
  var logStdout = process.stdout;
  if (!message) {
    logFile.write(
      util.format("Could not get message.") + "\n"
    );
  } else {
    logFile.write(message + "\n");
  }
}

function sendTranscription(message, id, name, userID) {
  try {
    const data = fs.readFileSync("../tickets/" + id + ".txt", 'utf8');
    let key = "\n";
    const ticketTranscript = data.split(key);
    var util = require("util");
    var logFile = fs.createWriteStream("../tickets/" + id + ".html", { flags: "a" });
    var logStdout = process.stdout;
    logFile.write(`
    <!DOCTYPE html>
    <html>
    <head>
    	<link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=PT Sans" />
    	<link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=Ubuntu" />
    	<title>Ranked Bridge Ticket Transcript</title>
    	<style>
    	</style>
    </head>
    <body>
      <h1>Ticket Transcript</h1>
    `);
    for (var i = 0; i < ticketTranscript.length; i++) {
      logFile.write(`<p>` + ticketTranscript[i] + `</p>\n`);
    }
    logFile.write(`
      </body>
      </html>
      `);
    setTimeout(function () {
      const file = new MessageAttachment("../tickets/" + id + ".html");
      const embed = new Discord.MessageEmbed()
        .setColor("#2f3136")
        .setTitle("Transcript for " + id)
        .setDescription("Created by <@" + userID + ">.")
        .setTimestamp();
      // Send the embd.
      message.guild.channels.cache.get(transcriptChannel).send({ embeds: [embed], files: [file] });
      message.guild.members.fetch(userID).then((member) => {
        try {
          member.send({ embeds: [embed], files: [file] }).catch((err) => message.guild.channels.cache.get(transcriptChannel).send("Couldn't DM <@" + userID + ">."));
        } catch (err) {
          message.guild.channels.cache.get(transcriptChannel).send("Couldn't get <@" + userID + ">.");
        }
      }).catch((err) => message.guild.channels.cache.get(transcriptChannel).send("Couldnt get <@" + userID + ">."));
    }, 1000);
  } catch (e) {
    console.error(e);
  }
}

client.login(token);
