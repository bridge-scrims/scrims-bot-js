const { VoiceBasedChannel, GuildMember, VoiceState } = require("discord.js");
const ScrimsSessionParticipant = require("../scrims/session_participant");
const ScrimsSession = require("../scrims/session");
const ScrimsUser = require("../scrims/user");

class VCSessionParticipant extends ScrimsSessionParticipant {

    constructor(...args) {

        super(...args)

        /** @type {number[]} */
        this.breaks = []

        /** @type {number} */
        this.left_at = null

    }

    /**
     * @param {VoiceChannelBasedSession} session 
     * @param {ScrimsUser} user 
     */
    joined(session, user) {

        this.setSession(session)
        this.setUser(user)
        this.setJoinPoint()
        return this;

    }

    disconnected() {

        this.left_at = Math.floor(Date.now() / 1000)

    }

    rejoined() {

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

    constructor(...args) {

        super(...args)

        /** @type {VoiceBasedChannel|null} */
        this.channel = null

        /** @type {Object.<string, VCSessionParticipant>} */
        this.participants = {}

        /**
         * @readonly
         * @type {import("../../bot")}
         */
        this.bot

    }

    /**
     * @param {VoiceBasedChannel} voiceChannel 
     * @param {string} typeName 
     * @param {GuildMember} creator 
     */
    start(voiceChannel, typeName, creator) {

        this.setType(typeName)
        this.setCreator({ discord_id: creator.id })
        this.setChannel(voiceChannel)
        this.setEndPoint(null)
        this.setStartPoint()

        this.initialize()
        this.addListeners()
        return this;
        
    }

    /** @param {VoiceBasedChannel|null} channel */
    setChannel(channel) {

        this.channel = channel
        return this;

    }

    addListeners() {

        this.voiceUpdateCallback = async (...args) => this.onVoiceStateUpdate(...args).catch(console.error)
        this.bot.on('voiceStateUpdate', this.voiceUpdateCallback)

    }

    initialize() {

        if (!this.channel) return false;
        for (const member of this.channel.members.values()) {

            if (member.scrimsUser && !(member.id in this.participants)) 
                this.participants[member.id] = new VCSessionParticipant(this.client).joined(this, member.scrimsUser)

        }

    }

    /**
     * @param {VoiceState} oldState 
     * @param {VoiceState} newState 
     */
    async onVoiceStateUpdate(oldState, newState) {

        const member = newState.member
        if (!this.channel || !member.scrimsUser) return false;

        // Someone joined this channel
        if (newState.channel === this.channel && oldState.channel !== this.channel) {

            if (!(member.id in this.participants)) {

                const scrimsUser = this.client.users.cache.find({ discord_id: member.id })
                // Someone joined for the first time of this session
                if (scrimsUser) this.participants[member.id] = new VCSessionParticipant(this.client).joined(this, member.scrimsUser)

            }else {

                // Someone rejoined
                this.participants[member.id].rejoined()

            }

        }

        // Someone left this channel
        if (oldState.channel === this.channel && newState.channel !== this.channel) {

            if (member.id in this.participants) {

                this.participants[member.id].disconnected()

            }

        }

    }

    destroy() {
        this.bot.off('voiceStateUpdate', this.voiceUpdateCallback)
        super.destroy()
    }

    async end(trimTime=0) {

        this.destroy()
        this.setEndPoint(Math.floor((Date.now() / 1000) - trimTime))

        const length = this.ended_at - this.started_at 
        // This session was to short to be saved in the database
        if (length < (3*60)) return false;

        await this.client.sessions.create(this)
        for (const participant of Object.values(this.participants))
            await participant.create().catch(console.error)

    }

}

module.exports = VoiceChannelBasedSession;