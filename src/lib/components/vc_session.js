const { VoiceBasedChannel, GuildMember, VoiceState } = require("discord.js");
const ScrimsSessionParticipant = require("../scrims/session_participant");
const ScrimsSession = require("../scrims/session");
const ScrimsUser = require("../scrims/user");

class VCSessionParticipant extends ScrimsSessionParticipant {

    /**
     * @param {VoiceChannelBasedSession} session 
     * @param {ScrimsUser} user 
     */
    constructor(session, user) {

        super(session.client)
    
        this.setSession(session)
        this.setUser(user)

        this.setJoinPoint()

        /** @type {number[]} */
        this.breaks = []

        /** @type {number} */
        this.left_at = null

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

    async create() {

        const referenceTime = this.left_at ?? (Date.now() / 1000)
        const breakTime = this.breaks.reduce((pv, cv) => pv + cv, 0)
        this.participation_time = Math.floor((referenceTime - this.joined_at) - breakTime)

        return this.client.sessionParticipants.create(this);

    }

}

class VoiceChannelBasedSession extends ScrimsSession {

    /**
     * @param {VoiceBasedChannel} voiceChannel 
     * @param {string} typeName 
     * @param {GuildMember} creator 
     */
    constructor(voiceChannel, typeName, creator) {

        super(voiceChannel.client.database)

        this.setType(typeName)
        this.setCreator({ discord_id: creator.id })
        this.setStartPoint()
        this.setEndPoint(null)

        /** @type {VoiceBasedChannel} */
        this.channel = voiceChannel

        /** @type {Object.<string, VCSessionParticipant>} */
        this.participants = {}

        /**
         * @readonly
         * @type { import("../../bot") }
         */
        this.bot

        this.initialize()
        this.addListeners()

    }

    addListeners() {

        this.voiceUpdateCallback = async (...args) => this.onVoiceStateUpdate(...args).catch(console.error)
        this.bot.on('voiceStateUpdate', this.voiceUpdateCallback)

    }

    initialize() {

        for (const member of this.channel.members.values()) {

            const scrimsUser = this.client.users.cache.find({ discord_id: member.id })
            if (scrimsUser && !(member.id in this.participants)) 
                this.participants[member.id] = new VCSessionParticipant(this, scrimsUser)

        }

    }

    /**
     * @param {VoiceState} oldState 
     * @param {VoiceState} newState 
     */
    async onVoiceStateUpdate(oldState, newState) {

        const member = newState.member

        // Someone joined this channel
        if (newState.channel === this.channel && oldState.channel !== this.channel) {

            if (!(member.id in this.participants)) {

                const scrimsUser = this.client.users.cache.find({ discord_id: member.id })
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

        this.setEndPoint(Math.floor((Date.now() / 1000) - trimTime))

        const length = this.ended_at - this.started_at 
        // This session was to short to be saved in the database
        if (length < (3*60)) return false;

        await this.client.sessions.create(this)
        for (const participant of Object.values(this.participants))
            await participant.create().catch(console.error)

        delete this.channel;
        delete this.participants;
        delete this.voiceUpdateCallback;

    }
}

module.exports = VoiceChannelBasedSession;