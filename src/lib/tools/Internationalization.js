const util = require('node:util');
const fs = require('fs/promises');

const path = require('path');
const LANGDIR = path.join('src', 'assets', 'lang');

class I18n {

    /**
     * @type { Object.<string, I18n> }
     */
    static instances = {};

    static async initializeLocales() {

        const files = await fs.readdir(LANGDIR)
        await Promise.all(files.map(fileName => this.loadLocal(fileName)))

    } 
    
    /**
     * @param { string } fileName 
     */
    static async loadLocal(fileName) {

        const content = await fs.readFile(path.join(LANGDIR, fileName), { encoding: 'utf8' }).then(v => JSON.parse(v))
        const localName = fileName.slice(0, -5)
        this.instances[localName] = new I18n(content)

    }

    /**
     * @param { string } locale 
     * @returns { I18n }
     */
    static getInstance(locale='en_us') {

        locale = locale.replace(/[^a-zA-Z]/g, '_').toLowerCase()

        return this.instances[locale] ?? this.instances['en_us'];

    }

    constructor(strings) {

        /**
         * @type { Object.<string, string> }
         */
        this.strings = strings

    }

    /**
     * @param { string } identifier 
     * @param  {...any} param 
     * @returns { string }
     */
    get(identifier, ...param) {

        if (!(identifier in this.strings)) return `UNKNOWN_RESOURCE`;

        return util.format(this.strings[identifier], ...param);

    }

}



module.exports = I18n;