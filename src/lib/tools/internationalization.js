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
    static getInstance(locale = 'en_us') {

        locale = locale.replace(/[^a-zA-Z]/g, '_').toLowerCase()

        return this.instances[locale] ?? this.instances['en_us'];

    }

    constructor(strings) {

        /** @type {Object.<string, string|import('discord.js').MessageEmbedOptions>} */
        this.strings = strings

    }

    /**
     * @param {string} identifier 
     * @param {...any} param 
     * @returns {string}
     */
    get(identifier, ...param) {

        if (!(identifier in this.strings) || (typeof this.strings[identifier] !== "string")) return `UNKNOWN_RESOURCE`;
        return util.format(this.strings[identifier], ...param);

    }

    /**
     * @param {string} identifier 
     * @param {string|Object.<string, string[]} [params]
     */
    getEmbed(identifier, ...params) {
 
        if (!params) params = []
        if (params.length === 1 && (typeof params[0] === "object")) params = params[0]
        else params = { description: params }

        if (!(identifier in this.strings)) return new MessageEmbed().setDescription(`UNKNOWN_RESOURCE`);

        const value = this.strings[identifier]
        if (typeof value === "string") return new MessageEmbed().setDescription(util.format(value, ...(params?.description ?? [])));
        return new MessageEmbed(this.formatObject(value, params));

    }

    formatObject(obj, params={}) {

        return Object.fromEntries(
            Object.entries(obj)
                .map(([key, val]) => [key, ((typeof val === "object") ? this.formatObject(val, params[key]) : this.formatString(val, params[key]))])
        )

    }

    formatString(string, params=[]) {

        const ids = string.split("%>").map(v => v.slice(0, v.indexOf(" "))).filter(v => v)
        for (const identifier of ids) string = string.replace(`%>${identifier}`, this.get(identifier))
        return util.format(string, ...params);

    }
}



module.exports = I18n;