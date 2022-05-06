const DBCache = require("../postgresql/cache");
const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

class ScrimsAttachmentCache extends DBCache {

}

class ScrimsAttachmentTable extends DBTable {

    constructor(client) {

        super(client, "scrims_attachment", "get_attachments", [], ['attachment_id'], ScrimsAttachment, ScrimsAttachmentCache);

        /**
         * @type { ScrimsAttachmentCache }
         */
        this.cache
        
    }

    /** 
     * @param { Object.<string, any> } filter
     * @param { Boolean } useCache
     * @returns { Promise<ScrimsAttachment[]> }
     */
    async get(filter, useCache) {

        return super.get(filter, useCache);

    }

    /** 
     * @param { Object.<string, any> } data
     * @returns { Promise<ScrimsAttachment> }
     */
    async create(data) {

        return super.create(data);

    }

    /** 
     * @param { Object.<string, any> } selector
     * @returns { Promise<ScrimsAttachment[]> }
     */
    async remove(selector) {

        return super.remove(selector);

    }

}

class ScrimsAttachment extends TableRow {

    /**
     * @type { ScrimsAttachmentTable }
     */
    static Table = ScrimsAttachmentTable

    constructor(client, attachmentData) {

        super(client, attachmentData, []);

        /**
         * @type { string }
         */
        this.attachment_id

        /**
         * @type { string }
         */
        this.filename

         /**
         * @type { string } https://en.wikipedia.org/wiki/Media_type
         */
        this.content_type

        /**
         * @type { string }
         */
        this.url

    }

}

module.exports = ScrimsAttachment;