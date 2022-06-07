const { MessageAttachment } = require("discord.js");
const TableRow = require("../postgresql/row");

const ScrimsAttachment = require("./attachment");
const ScrimsTicket = require("./ticket");

class ScrimsTicketMessageAttachment extends TableRow {

    static uniqueKeys = ['message_id', 'attachment_id']
    static columns = ['id_ticket', 'message_id', "attachment_id"]

    constructor(client, messageAttachmentData) {

        super(client, messageAttachmentData)

        /** @type {string} */
        this.id_ticket

        /** @type {ScrimsTicket} */
        this.ticket
        
        /** @type {string} */
        this.message_id

        /** @type {string} */
        this.attachment_id

        /** @type {ScrimsAttachment} */
        this.attachment

    }

    /**
     * @param {string|Object.<string, any>|ScrimsTicket} ticketResolvable 
     */
    setTicket(ticketResolvable) {

        this._setForeignObjectReference(this.client.tickets, 'ticket', ['id_ticket'], ['id_ticket'], ticketResolvable)
        return this;

    }

    /**
     * @param {string} message_id 
     */
    setMessageId(message_id) {

        this.message_id = message_id
        return this;

    }

    /** @param {import("discord.js").MessageResolvable} */
    setMessage(messageResolvable) {

        this.message_id = messageResolvable?.id ?? messageResolvable
        return this;

    }

    /**
     * @param {string|Object.<string, any>|ScrimsAttachment|MessageAttachment} attachmentResolvable 
     */
    setAttachment(attachmentResolvable) {

        if (attachmentResolvable instanceof MessageAttachment) attachmentResolvable = attachmentResolvable.id
        
        this._setForeignObjectReference(this.client.attachments, 'attachment', ['attachment_id'], ['attachment_id'], attachmentResolvable)
        return this;

    }

    get attachmentURL() {

        return this.attachment.url;

    }

    get discordGuild() {

        if (!this.ticket?.discordGuild) return null;
        return this.ticket.discordGuild;

    }

    get guild_id() {

        if (!this.ticket?.guild_id) return null;
        return this.ticket.guild_id;

    }

    get channel() {

        if (!this.ticket?.channel) return null;
        return this.ticket.channel;

    }

    get message() {

        if (!this.channel || !this.message_id) return null;
        return this.channel.messages.resolve(this.message_id);

    }

    /** 
     * @override
     * @param {Object.<string, any>} messageAttachmentData 
     */
    update(messageAttachmentData) {
        
        super.update(messageAttachmentData);

        this.setTicket(messageAttachmentData.ticket)
        this.setAttachment(messageAttachmentData.attachment)

        return this;

    }

}

module.exports = ScrimsTicketMessageAttachment;