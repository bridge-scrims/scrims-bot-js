const TableRow = require("../postgresql/row");

class ScrimsAttachment extends TableRow {

    static uniqueKeys = ['attachment_id']
    static columns = ['attachment_id', 'filename', 'content_type', 'url']

    /**
     * @param {import("discord.js").MessageAttachment} attachment 
     */
    static fromMessageAttachment(client, attachment) {

        return new ScrimsAttachment(client, { attachment_id: attachment.id, filename: attachment.name, content_type: attachment.contentType, url: attachment.proxyURL });

    }

    constructor(client, attachmentData) {

        super(client, attachmentData);

        /** @type {string} */
        this.attachment_id

        /** @type {string} */
        this.filename

        /** @type {string} https://en.wikipedia.org/wiki/Media_type */
        this.content_type

        /** @type {string} */
        this.url

    }

    /**
     * @param {string} attachment_id 
     */
    setId(attachment_id) {
        
        this.attachment_id = attachment_id
        return this;

    }

    /**
     * @param {string} filename 
     */
    setFilename(filename) {
        
        this.filename = filename
        return this;

    }

    /** 
     * @param {string} content_type https://en.wikipedia.org/wiki/Media_type
     */
    setContentType(content_type) {

        this.content_type = content_type
        return this;

    }

    /**
     * @param {string} url 
     */
    setURL(url) {

        this.url = url
        return this;

    }

}

module.exports = ScrimsAttachment;