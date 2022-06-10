const EventEmitter = require("events");

/** @template [T=import("./row")] */
class DBCache extends EventEmitter {

    constructor(options={}) {

        super()
        this.setMaxListeners(0)

        /** @type {number} */
        this.lifeTime = options.lifeTime ?? 60*60

        /** @type {Object.<string, T>} */
        this.data = {}

        this.on('push', value => this.emit('change', value))
        this.on('update', value => this.emit('change', value))
        this.on('remove', value => this.emit('change', value))

        setInterval(() => this.removeExpired(), 2*60*1000)

    }

    removeExpired() {

        const now = Date.now()/1000
        Object.entries(this.data)
            .filter(([_, value]) => value.isCacheExpired(now))
            .forEach(([key, _]) => this.remove(key))

    }   

    values() {

        return Object.values(this.data);

    }

    keys() {

        return Object.keys(this.data);

    }

    /**
     * @param {T} value
     * @param {T} [existing]
     * @returns {T}
     */
    push(value, existing=null) {

        if (value === null) return null;

        if (existing === null) existing = this.resolve(value.id)
    
        if (existing) {
            
            this.updateWith(value, existing)
            
        }else {

            this.set(value.id, value)
            this.setExpiration(value)
            this.emit('push', value)

        }

        return existing ?? value;

    }

    /**
     * @param {string} id
     * @param {T} value 
     */
    set(id, value) {

        this.data[id] = value

    }

    /**
     * @param {T[]} values 
     */
    setAll(values) {

        const oldKeys = this.keys()

        const newData = Object.fromEntries(values.map(value => [value.id, value]))
        const newKeys = Object.keys(newData)

        const added = values.filter(value => value.id).filter(value => !(value.id in this.data))
        
        //If all of the new data is not yet added we do not need to emit all those push events
        if (added.length !== newKeys.length) added.forEach(value => this.emit('push', value))

        oldKeys.filter(key => !(key in newData)).forEach(key => this.remove(key))
        this.data = newData

        values.forEach(value => this.setExpiration(value))
        this.removeExpired()

    }

    /**
     * @param {string[]} mapKeys
     * @returns { { [x: string]: T } }
     */
    getMap(...mapKeys) {

        return Object.fromEntries(this.values().map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value]));

    }

    /**
     * @param {string[]} mapKeys
     * @returns { { [x: string]: T[] } }
     */
    getArrayMap(...mapKeys) {

        const obj = {}

        this.values().map(value => [mapKeys.reduce((v, key) => (v ?? {})[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        
        return obj;

    }

    /**
     * @param {string[]} ids
     * @returns {T}
     */ 
    resolve(...ids) {

        return this.data[ids.join('#')] ?? null;

    }

    /**
     * @param {Object.<string, any>|Array.<string>|Array.<Array.<string>>|T} [options] If fasley, gets all.
     * @returns {T[]}
     */ 
    get(options) {

        if (!options) return this.values();

        if (options instanceof Array) {

            const ids = options.map(id => (id instanceof Array) ? id.join("#") : id)
            return ids.map(id => this.data[id]).filter(v => v);

        }

        return this.filter(v => v.equals(options));

    }

    /**
     * @param {Object.<string, any>|Array.<string>|string|number|T} options
     * @returns {T}
     */ 
    find(options) {

        if (typeof options !== "object") options = [options]

        if (options instanceof Array) {

            const id = options.join("#")
            return this.data[id];

        }

        return this.filter(v => v.equals(options))[0] ?? null;

    }

    /**
     * @param { (value: T, index: number, array: T[]) => boolean } predicate
     * @returns { T[] }
     */ 
    filter(predicate) {

        return this.values().filter(predicate);

    }

    /**
     * @param {Object.<string, any>|T} filter
     * @returns {T[]}
     */
    filterOut(filter) {

        const remove = this.get(filter)
        remove.forEach(value => this.remove(value.id))
        return remove;

    }

    /**
     * @param {string} id
     * @returns {T}
     */
    remove(id) {

        const remove = this.data[id]
        if (remove) {
            
            delete this.data[id]
            this.emit('remove', remove)
            
        }
        return remove ?? null;

    }

    /**
     * @param {T} value
     */
    setExpiration(value) {

        if (this.lifeTime > 0) value.setCacheExpiration(Math.floor((Date.now()/1000) + this.lifeTime))
        
    }

    /**
     * @param {T|Object.<string, any>} value
     * @param {T} existing
     */
    updateWith(value, existing) {

        const oldId = existing.id
        if (existing && !existing.exactlyEquals(value)) {

            existing.update(value)
            if (oldId !== existing.id) {

                this.remove(oldId)
                this.push(existing)

            }else {

                this.setExpiration(existing)
                this.emit('update', existing)

            }

            return true;

        }

        return false;

    }
    
    /**
     * @param {Object.<string, any>} selector
     * @param {T|Object.<string, any>} data
     */
    update(selector, data) {

        const update = this.get(selector)
        update.forEach(obj => this.updateWith(data, this.resolve(obj.id)))

    }

}

module.exports = DBCache;