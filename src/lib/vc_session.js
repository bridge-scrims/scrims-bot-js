const { VoiceBasedChannel, GuildMember, VoiceState } = require("discord.js");
const ScrimsSession = require("./scrims/session");
const ScrimsSessionParticipant = require("./scrims/session_participant");
const ScrimsSessionType = require("./scrims/session_type");
const ScrimsUser = require("./scrims/user");

class VCSessionParticipant extends ScrimsSessionParticipant {

    /**
     * @param { VoiceChannelBasedSession } session 
     * @param { ScrimsUser } user 
     */
    constructor(session, user) {

        super(session.client.sessionParticipants, { session, user, joined_at: Math.floor(Date.now() / 1000), breaks: [], left_at: null })
    
        /**
         * @type { number[] }
         */
        this.breaks

        /**
         * @type { number }
         */
        this.left_at

    }

    onDisconnect() {

        this.left_at = Math.floor(Date.now() / 1000)

    }

    onRejoin() {

        if (this.left_at) {

            this.breaks.push(Math.floor((Date.now() / 1000) - this.left_at))
            this.left_at = null

        }else {

            this.joined_at = Math.floor(Date.now() / 1000)

        }

    }

    /**
     * @override
     */
    async create() {

        const referenceTime = this.left_at ?? (Date.now() / 1000)
        const breakTime = this.breaks.reduce((pv, cv) => pv + cv, 0)
        this.participation_time = Math.floor((referenceTime - this.joined_at) - breakTime)

        return super.create();

    }

}

class VoiceChannelBasedSession extends ScrimsSession {

    /**
     * @param { VoiceBasedChannel } voiceChannel 
     * @param { string } typeName 
     * @param { GuildMember } creator 
     */
    constructor(voiceChannel, typeName, creator) {

        const data = { 
            id_session: voiceChannel.client.database.generateUUID(),
            type: { name: typeName }, 
            creator: { discord_id: creator.id }, 
            started_at: Math.floor(Date.now() / 1000),
            ended_at: null
        }

        super(voiceChannel.client.database.sessions, data)

        /**
         * @type { VoiceBasedChannel }
         */
        this.channel = voiceChannel

        /**
         * @type { Object.<string, VCSessionParticipant>  }
         */
        this.participants = {}

        /**
         * @readonly
         * @type { import("../bot") }
         */
        this.bot

        this.initialize()
        this.addListeners()

    }

    addListeners() {

        this.voiceUpdateCallback = async (...args) => this.onVoiceStateUpdate(...args).catch(console.error)
        this.bot.on('voiceStateUpdate', this.voiceUpdateCallback)

    }

    async initialize() {

        for (const member of this.channel.members.values()) {

            const scrimsUser = await this.client.users.get({ discord_id: member.id }).then(v => v[0]).catch(() => null)
            if (scrimsUser && !(member.id in this.participants)) 
                this.participants[member.id] = new VCSessionParticipant(this, scrimsUser)

        }

    }

    /**
     * @param { VoiceState } oldState 
     * @param { VoiceState } newState 
     */
    async onVoiceStateUpdate(oldState, newState) {

        const member = newState.member

        // Someone joined this channel
        if (newState.channel === this.channel && oldState.channel !== this.channel) {

            if (!(member.id in this.participants)) {

                const scrimsUser = await this.client.users.get({ discord_id: member.id }).then(v => v[0]).catch(() => null)
                // Someone joined for the first time of this session
                if (scrimsUser) this.participants[member.id] = new VCSessionParticipant(this, scrimsUser)

            }else {

                // Someone rejoined
                this.participants[member.id].onRejoin()

            }

        }

        // Someone left this channel
        if (oldState.channel === this.channel && newState.channel !== this.channel) {

            if (member.id in this.participants) {

                this.participants[member.id].onDisconnect()

            }

        }

    }

    async end(trimTime=0) {

        this.bot.off('voiceStateUpdate', this.voiceUpdateCallback)

        this.updateWith({ ended_at: Math.floor((Date.now() / 1000) - trimTime) })
        const length = this.ended_at - this.started_at 

        // This session was to short to be saved in the database
        if (length < (3*60)) return false;

        await this.create()
        for (const participant of Object.values(this.participants))
            await participant.create()

        delete this.channel;
        delete this.participants;
        delete this.voiceUpdateCallback;

    }
}

module.exports = VoiceChannelBasedSession;