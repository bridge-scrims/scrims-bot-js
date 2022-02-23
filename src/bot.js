const handleInteraction = require('./interaction-handler.js');
const TicketTranscriber = require("./ticket-transcriber.js");
const handleMessage = require('./message-handler.js');
const Commands = require("./assets/commands.json");
const discordModals = require('discord-modals');
const DBClient = require("./db-client.js");
const { Client } = require("discord.js");

class TicketBot extends Client {

    constructor(config) {
        super({ 
			intents: [ 
                "GUILD_MEMBERS", "GUILDS", 'GUILD_MESSAGES', 
                "GUILD_VOICE_STATES", "GUILD_MESSAGE_REACTIONS" 
            ],
            partials: [ 'MESSAGE', 'CHANNEL' ]
		});

        this.config = config;
        this.commands = Commands;
        this.transcriptChannel = null;

        this.prefix = config.prefix;
        this.supportRoles = config?.supportRoles ?? [];
        this.staffRoles = config?.staffRoles ?? [];

        discordModals(this);
    }

    async login() {

        await super.login(this.config.token);

        this.database = new DBClient(this.config);
        await this.database.initializeCache();

        this.transcriber = new TicketTranscriber();
        
        const transcriptChannelId = this.config.transcriptChannelId
        if (transcriptChannelId) {
            this.transcriptChannel = await this.channels.fetch(transcriptChannelId)
        }

        const guilds = await this.guilds.fetch().then(oAuth2Guilds => Promise.all(oAuth2Guilds.map(oAuth2Guild => oAuth2Guild.fetch())))
        this.commands = Object.fromEntries(
            await Promise.all(
                guilds.map(guild => guild.commands.set([])
                    .then(() => Promise.all(
                        this.commands.map(cmd => guild.commands.create({ ...cmd, permissionLevel: undefined })
                            .then(appCmd => ({ ...appCmd, permissionLevel: cmd.permissionLevel })))
                        )
                    ).then(guildCommands => [ guild.id, guildCommands ])
                )
            )
        )

        await Promise.all(
            guilds.map(guild => guild.members.fetch()
                .then(members => Promise.all(members.map(member => this.addMemberPermissions(member))))
            )
        )

        this.addEventListeners();
        console.log("Startup complete")

    }

    addEventListeners() {

        this.on('modalSubmit', handleInteraction);

        this.on('interactionCreate', async (interaction) => {
			if (interaction?.user?.bot) return false;

			if (interaction.partial) interaction = await interaction.fetch().catch(console.error)
			if (!interaction || interaction.partial) return false;
	
			return handleInteraction(interaction);
		});
		
		this.on('messageCreate', async (message) => {
			if (message.type === 'CHANNEL_PINNED_MESSAGE') return false;
            if (message?.author?.bot) return false;

			if (message.partial) message = await message.fetch().catch(console.error)
			if (!message || message.partial) return false;
	
			return handleMessage(message);
		});

        this.on('roleUpdate', async (oldRole, newRole) => {
            const changes = this.getCommandPermissionLevels().filter(level => this.hasPermission(oldRole, level) != this.hasPermission(newRole, level))
            if (changes.length < 1) return false;
            await Promise.allSettled(
                changes.map(permissionLevel => this.addPermissions(
                        newRole.guild, permissionLevel, newRole.members.map(
                            member => this.hasPermission(member, permissionLevel) == this.hasPermission(newRole, permissionLevel)
                        ), this.hasPermission(newRole, permissionLevel)
                    )
                )
            )
        })

        this.on('guildMemberUpdate', async (oldMember, newMember) => {
            const changes = this.getCommandPermissionLevels().filter(level => this.hasPermission(oldMember, level) != this.hasPermission(newMember, level))
            if (changes.length < 1) return false;
            await Promise.allSettled(
                changes.map(permissionLevel => this.addPermissions(newMember.guild, permissionLevel, [newMember], this.hasPermission(newMember, permissionLevel)))
            )
        })

        this.on('guildMemberAdd', async (member) => {
            await this.addMemberPermissions(member)
        })

    }

    getCommandPermissionLevels() {
        return Object.values(this.commands)[0].map(cmd => cmd.permissionLevel);
    }

    async addMemberPermissions(member) {
        const perms = this.getCommandPermissionLevels().filter(level => this.hasPermission(member, level))
        if (perms.length < 1) return false;
        await Promise.all(
            perms.map(permissionLevel => this.addPermissions(member.guild, permissionLevel, [member], this.hasPermission(member, permissionLevel)))
        )
    }

    hasPermission(thing, permissionLevel) {
        if (permissionLevel == "ALL") return true;

        if (thing?.permissions.has("ADMINISTRATOR")) return true;
        if (permissionLevel == "ADMIN") return false;

        if (this.staffRoles.some(roleId => thing?.roles?.cache?.has(roleId))) return true;
        if (permissionLevel == "STAFF") return false;

        if (this.supportRoles.some(roleId => thing?.roles?.cache?.has(roleId))) return true;
        if (permissionLevel == "SUPPORT") return false;

        return false;
    }

    async addPermissions(guild, permissionLevel, members, permission) {
        /*
        if (guild.id == "911760601926217819") console.log("SETTING " + permissionLevel + " PERMS FOR " + members[0].displayName)
        if (guild.id == "911760601926217819") console.log(this.commands[guild.id].filter(cmd => cmd.permissionLevel == permissionLevel)
        .map(cmd => ({ command: cmd.id, permissions: members.map(member => JSON.stringify({ id: member.id, type: 'USER', permission })) })))
        */
       
        await Promise.all(
            this.commands[guild.id].filter(cmd => cmd.permissionLevel == permissionLevel)
                .map(cmd => guild.commands.permissions.add(
                    { command: cmd.id, permissions: members.map(member => ({ id: member.id, type: 2, permission })) }
                ))
        )
    }

}

module.exports = TicketBot;