const EventEmitter = require("events");

/**
 * @typedef { import("./table").Row } TableRow
 */

class DBCache extends EventEmitter {

    constructor() {

        super()
        this.setMaxListeners(0)

        /**
         * @type { number }
         */
        this.handleIndex = 1

        /**
         * @type { string }
         */
        this.handlesKey = `_${Date.now()}`

        /**
         * @type { TableRow[] }
         */
        this.data = []

    }

    createHandle(filter) {

        const row = this.get(filter)[0] ?? null
        if (!row) return [null, null];

        return this.addHandle(row);

    }

    addHandle(row) {

        const handleId = this.handleIndex
        this.handleIndex += 1

        if (row[this.handlesKey]) row[this.handlesKey].push(handleId)
        else row[this.handlesKey] = [handleId]

        return [handleId, row];

    }

    releaseHandle(handleId) {

        this.data.forEach(row => {

            if (row[this.handlesKey]) {

                row[this.handlesKey] = row[this.handlesKey].filter(value => value !== handleId)
            
            }

        })

    }

    /**
     * @param { TableRow } value
     * @param { Boolean } withHandle
     * @returns { TableRow }
     */
    push(value, existing=null, withHandle=false) {

        if (value === null) return null;

        if (existing === null) existing = this.get(value)[0]
    
        if (existing) {
            
            const index = this.data.indexOf(existing)
            this.data[index] = existing.updateWith(value)

        }else {

            value.cache()
            this.data.push(value)

        }

        this.emit('push', value)
        
        if (withHandle) return this.addHandle(existing ?? value);
        return value;

    }

    /**
     * @param { TableRow[] } values 
     */
    set(values) {

        return values.map(value => this.push(value));

    }

    /**
     * @param { string[] } mapKeys
     * @returns { Object.<string, TableRow> }
     */
    getMap( ...mapKeys ) {

        return Object.fromEntries(this.data.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value]));

    }

    /**
     * @param { string[] } mapKeys
     * @returns { Object.<string, TableRow[]> }
     */
    getArrayMap( ...mapKeys ) {

        const obj = {}

        this.data.map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /**
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { TableRow[] }
     */ 
    get(filter, invert) {

        if (invert) return this.data.filter(row => !row.equals(filter));
        else return this.data.filter(row => row.equals(filter));

    }

    /**
     * @returns { TableRow[] }
     */
    remove(filter) {

        const remove = this.get(filter)
        
        this.data = this.data.filter(value => !remove.includes(value))
        remove.forEach(value => this.emit('remove', value))

        return remove;

    }

    /**
     * @param { TableRow } newValue 
     * @param { Object.<string, any> } filter 
     */
    update(newValue, filter) {

        const matches = this.get(filter)
        matches.forEach(value => {

            const index = this.data.indexOf(value)
            this.data[index] = value.updateWith(newValue)
            this.emit('update', this.data[index])

        })

    }

}

module.exports = DBCache;