const EventEmitter = require("events");

/** @template [T=import("./row")] */
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
         * @type { Object.<string, T> }
         */
        this.data = {}

        this.on('push', value => this.emit('change', value))
        this.on('update', value => this.emit('change', value))
        this.on('remove', value => this.emit('change', value))

    }

    values() {

        return Object.values(this.data);

    }

    keys() {

        return Object.keys(this.data);

    }

    createHandle(id) {

        const row = this.resolve(id)
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
     * @param { import("./row") } value
     * @param { Boolean } withHandle
     * @returns { T }
     */
    push(value, existing=null, withHandle=false) {

        if (value === null) return null;

        if (existing === null) existing = this.resolve(value.id)
    
        if (existing) {
            
            if (!existing.exactlyEquals(value)) {

                existing.updateWith(value)
                this.emit('update', existing)

            }
            
        }else {

            value.cache()
            this.set(value.id, value)
            this.emit('push', value)

        }

        if (withHandle) return this.addHandle(existing ?? value);
        return existing ?? value;

    }

    /**
     * @param { T } value 
     */
    set(id, value) {

        this.data[id] = value

    }

    /**
     * @param { T[] } values 
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
     * @returns { { [x: string]: T } }
     */
    getMap( ...mapKeys ) {

        return Object.fromEntries(this.values().map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value]));

    }

    /**
     * @param { string[] } mapKeys
     * @returns { { [x: string]: T[] } }
     */
    getArrayMap( ...mapKeys ) {

        const obj = {}

        this.values().map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /**
     * @param { string[] } ids
     * @returns { T }
     */ 
    resolve(...ids) {

        return this.data[ids.join('#')] ?? null;

    }

    /**
     * @param { Object.<string, any> } filter
     * @param { Boolean } invert
     * @returns { T[] }
     */ 
    get(filter, invert) {

        if (invert) return this.values().filter(row => !row.equals(filter));
        else return this.values().filter(row => row.equals(filter));

    }

    /**
     * @param { (value: T, index: number, array: T[]) => boolean } predicate
     * @returns { T[] }
     */ 
    filter(predicate) {

        return this.values().filter(predicate);

    }

    /**
     * @param { Object.<string, any> } filter
     * @returns { T[] }
     */
    filterOut(filter) {

        const remove = this.get(filter)
        remove.forEach(value => this.remove(value.id))
        return remove;

    }

    /**
     * @param { string } id
     * @returns { T }
     */
    remove(id) {

        const remove = this.data[id]
        if (remove) {
            
            if (id in this.handles) delete this.handles[id];

            delete this.data[id]
            remove.uncache()
            this.emit('remove', remove)
            
        }
        return remove ?? null;

    }

    /**
     * @param { T } value
     * @param { string } id
     */
    updateWith(value, id) {

        const existing = this.resolve(id ?? value.id)
        if (existing && !existing.exactlyEquals(value)) {

            existing.updateWith(value)
            this.emit('update', existing)

        }

    }
    
    /**
     * @param { T } data
     * @param { Object.<string, any> } selector
     */
    update(data, selector) {

        const update = this.get(selector)
        update.forEach(obj => this.updateWith(data, obj.id))

    }

}

module.exports = DBCache;