const EventEmitter = require("events");

class DBCache extends EventEmitter {

    constructor() {

        super()
        this.setMaxListeners(0)

        /**
         * @type { number }
         */
        this.handleIndex = 1

        /**
         * @type { Object.<string, number[]> }
         */
        this.handles = {}

        /**
<<<<<<< HEAD
         * @type { Object.<string, import("./row")> }
=======
         * @type { TableRow[] }
>>>>>>> main
         */
        this.data = {}

    }

    values() {

        return Object.values(this.data);

    }

    createHandle(id) {

        const row = this.get(id)
        if (!row) return [null, null];

        return this.addHandle(row);

    }

    addHandle(row) {

        const handleId = this.handleIndex
        this.handleIndex += 1

        if (this.handles[row.id]) this.handles[row.id].push(handleId)
        else this.handles[row.id] = [handleId]

        return [handleId, row];

    }

    releaseHandle(handleId) {

        Object.keys(this.handles).forEach(key => {

            this.handles[key] = this.handles[key].filter(value => value !== handleId)

        })

    }

    /**
     * @param { TableRow } value
     * @param { Boolean } withHandle
     * @returns { TableRow }
     */
    push(value, existing=null, withHandle=false) {

        if (value === null) return null;

        if (existing === null) existing = this.get(value.id)
    
        if (existing) {
            
            const index = this.data.indexOf(existing)
            this.data[index] = existing.updateWith(value)

<<<<<<< HEAD
                existing.updateWith(value)
                this.emit('update', existing)

            }
            
        }else {

            value.cache()
            this.set(value.id, value)
            this.emit('push', value)
=======
        }else {

            value.cache()
            this.data.push(value)
>>>>>>> main

        }

        this.emit('push', value)
        
        if (withHandle) return this.addHandle(existing ?? value);
        return value;

    }

    /**
<<<<<<< HEAD
     * @param { import("./row") } value 
     */
    set(id, value) {

        this.data[id] = value

    }

    /**
     * @param { import("./row")[] } values 
=======
     * @param { TableRow[] } values 
>>>>>>> main
     */
    setAll(values) {

        const oldKeys = Object.keys(this.data)

        values.forEach(value => value.cache())
        values.filter(value => !oldKeys.includes(value.id)).forEach(value => this.emit('push', value))

        const newData = Object.fromEntries(values.map(value => [value.id, value]))
        const newKeys = Object.keys(newData)
        oldKeys.filter(key => !newKeys.includes(key)).forEach(key => this.remove(key))
        this.data = newData

    }

    /**
     * @param { string[] } mapKeys
     * @returns { Object.<string, TableRow> }
     */
    getMap( ...mapKeys ) {

        return Object.fromEntries(this.values().map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value]));

    }

    /**
     * @param { string[] } mapKeys
     * @returns { Object.<string, TableRow[]> }
     */
    getArrayMap( ...mapKeys ) {

        const obj = {}

        this.values().map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /**
     * @param { string[] } ids
     * @returns { import("./row") }
     */ 
    get(...ids) {

        return this.data[ids.join('#')] ?? null;

    }

    /**
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { TableRow[] }
     */ 
    find(filter, invert) {

        if (invert) return this.values().filter(row => !row.equals(filter));
        else return this.values().filter(row => row.equals(filter));

    }

    /**
<<<<<<< HEAD
     * @param { Object.<string, any> } filter
     * @returns { import("./row")[] }
     */
    filterOut(filter) {
=======
     * @returns { TableRow[] }
     */
    remove(filter) {

        const remove = this.get(filter)
        
        this.data = this.data.filter(value => !remove.includes(value))
        remove.forEach(value => this.emit('remove', value))
>>>>>>> main

        const remove = this.find(filter)
        remove.forEach(value => this.remove(value.id))
        return remove;

    }

    /**
<<<<<<< HEAD
     * @param { string } id
     * @returns { import("./row") }
=======
     * @param { TableRow } newValue 
     * @param { Object.<string, any> } filter 
>>>>>>> main
     */
    remove(id) {

        const remove = this.data[id]
        if (remove) {
            
            if (id in this.handles) delete this.handles[id];

<<<<<<< HEAD
            delete this.data[id]
            remove.uncache()
            this.emit('remove', remove)
            
        }
        return remove ?? null;

    }
=======
            const index = this.data.indexOf(value)
            this.data[index] = value.updateWith(newValue)
            this.emit('update', this.data[index])
>>>>>>> main

    /**
     * @param { import("./row") } value
     * @param { string } id
     */
    updateWith(value, id) {

        const existing = this.get(id ?? value.id)
        if (existing && !existing.exactlyEquals(value)) {

            existing.updateWith(value)
            this.emit('update', existing)

        }

    }
    
    /**
     * @param { import("./row") } data
     * @param { Object.<string, any> } selector
     */
    update(data, selector) {

        const update = this.find(selector)
        update.forEach(obj => this.updateWith(data, obj.id))

    }

}

module.exports = DBCache;