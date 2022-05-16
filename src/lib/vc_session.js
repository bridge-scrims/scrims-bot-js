const { VoiceBasedChannel, GuildMember, VoiceState } = require("discord.js");
const ScrimsSession = require("./scrims/session");
const ScrimsSessionType = require("./scrims/session_type");

class VCParticipantInformation {

    constructor(member) {

        /**
         * @type { GuildMember }
         */
        this.member = member

        /**
         * @type { number }
         */
        this.joined_at = Math.floor(Date.now() / 1000)

        /**
         * @type { number[] }
         */
        this.breaks = []

        /**
         * @type { number }
         */
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

    getConnectTime() {

        const referenceTime = this.left_at ?? (Date.now() / 1000)
        return Math.floor((referenceTime - this.joined_at) - this.breaks.reduce((pv, cv) => pv + cv, 0));

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
            started_at: Math.floor(Date.now() / 1000) 
        }

        super(voiceChannel.client.database.sessions, data)

        /**
         * @type { VoiceBasedChannel }
         */
        this.channel = voiceChannel

        /**
         * @type { Object.<string, VCParticipantInformation>  }
         */
        this.participants = {}

        /**
         * @readonly
         * @type { import("../bot") }
         */
        this.bot

        this.addListeners()

    }

    addListeners() {

        this.voiceUpdateCallback = async (...args) => this.onVoiceStateUpdate().catch(console.error)
        this.bot.on('voiceStateUpdate', this.voiceUpdateCallback)

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

                // Someone joined for the first time of this session
                this.participants[member.id] = new VCParticipantInformation(member)

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

        const length = (Date.now() / 1000) - this.started_at - trimTime

        // This session was to short to be saved in the database
        //if (length < (3*60)) return false;

        await this.create()

        delete this.channel;
        delete this.participants;
        delete this.voiceUpdateCallback;

    }
}

module.exports = VoiceChannelBasedSession;