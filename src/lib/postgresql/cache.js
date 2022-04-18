const EventEmitter = require("events");

/**
 * @typedef { import("./table").Row } TableRow
 */

class DBCache extends EventEmitter {

    constructor() {

        super()
        this.setMaxListeners(0)

        /**
         * @type { TableRow[] }
         */
        this.data = []

    }

    /**
     * @param { TableRow } value
     * @returns { TableRow }
     */
    push(value) {

        if (value === null) return null;

        const existing = this.get(value)[0]
    
        if (existing) {
            
            const index = this.data.indexOf(existing)
            this.data[index] = existing.updateWith(value)

        }else {

            this.data.push(value)

        }

        this.emit('push', value)
        
        return value;

    }

    /**
     * @param { TableRow[] } values 
     */
    set(values) {

        this.data = values

    }

    /**
     * @param { [ string, any ][] } obj1 
     * @param { TableRow } obj2 
     * @returns { Boolean }
     */
    valuesMatch(obj1, obj2) {

        if (!obj1 || !obj2) return false;

        if (typeof obj1.toJSON === "function") obj1 = obj1.toJSON();
        if (typeof obj2.toJSON === "function") obj2 = obj2.toJSON();

        return obj1.every(([key, value]) => 
            (value instanceof Object && obj2[key] instanceof Object) 
                ? this.valuesMatch(Object.entries(value), obj2[key]) : (obj2[key] == value)
        );

    }

    /**
     * @param { string[] } mapKeys
     * @returns { Object.<string, TableRow> }
     */
    getMap( ...mapKeys ) {

        return Object.fromEntries(this.data.map(value => [mapKeys.reduce((v, key) => v[key], value), value]));

    }

    /**
     * @param { string[] } mapKeys
     * @returns { Object.<string, TableRow[]> }
     */
    getArrayMap( ...mapKeys ) {

        const obj = {}

        this.data.map(value => [mapKeys.reduce((v, key) => v[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /**
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { TableRow[] }
     */ 
    get(filter, invert) {

        const entries = Object.entries(filter)

        if (invert) return this.data.filter(value => !this.valuesMatch(entries, value));
        else return this.data.filter(value => this.valuesMatch(entries, value));

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