const TableRow = require("../postgresql/row");
const DBTable = require("../postgresql/table");

/**
 * @extends DBTable<ScrimsAttachment>
 */
class ScrimsAttachmentTable extends DBTable {

    constructor(client) {

        super(client, "scrims_attachment", "get_attachments", [], ['attachment_id'], ScrimsAttachment);
        
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