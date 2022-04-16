const BridgeScrimsCache = require("../cache");

class DBCache extends BridgeScrimsCache {

    constructor(defaultTTL, maxKeys) {

        super(defaultTTL, maxKeys);
        
        this.index = 0

    }

    /**
     * @returns { TableRow | false }
     */
    push(value, ttl, handels) {

        if (value === null) return null;

        const existing = this.getEntrys(value)[0] ?? []
        const key = existing[0] ?? this.index

        const inserted = this.set( key, value, ttl, handels )
        if ((key === this.index) && inserted) this.index += 1
        if (inserted) this.emit('push', inserted)
        
        return inserted;

    }

    valuesMatch(obj1, obj2) {

        if (!obj1 || !obj2) return false;

        if (typeof obj1.toJSON === "function") obj1 = obj1.toJSON();
        if (typeof obj2.toJSON === "function") obj2 = obj2.toJSON();

        return Object.entries(obj1).every(([key, value]) => (value instanceof Object) ? this.valuesMatch(value, obj2[key]) : (obj2[key] == value));

    }

    /**
     * 
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert 
     * @returns { [ string, any ][] }
     */
    getEntrys(filter={}, invert=false) {
        
        const entries = Object.entries(this.data).map(([ key, value ]) => ([ key, value.value ]))
        
        if (invert) return entries.filter(([ _, value ]) => !this.valuesMatch(filter, value));
        else return entries.filter(([ _, value ]) => this.valuesMatch(filter, value));

    }

    /**
     * @override
     * @param { { [s: string]: any } } filter
     * @param { Boolean } invert
     * @returns { TableRow[] }
     */ 
    get(filter, invert) {

        const entrys = this.getEntrys(filter, invert)
        return entrys.map(([ _, value ]) => value);

    }

    /**
     * @override
     * @returns { TableRow[] }
     */
    remove(filter) {

        const entrys = this.getEntrys(filter, false)

        entrys.forEach(([ key, _ ]) => this.delete(key))
        entrys.forEach(([ _, value ]) => this.emit('remove', value))

        return entrys.map(([ _, value ]) => value);

    }

    /**
     * @override
     */
    update(newValue, filter) {

        const entries = this.getEntrys(filter, false)
            .filter(([ _, oldValue ]) => !this.valuesMatch(newValue, oldValue))
            .map(([ key, oldValue ]) => [ key, oldValue.updateWith(newValue) ])
            
        entries.forEach(([ key, value ]) => super.update(key, value))
        entries.forEach(([ key, value ]) => this.emit('update', value))

        return true;

    }

    /**
     * @override
     */
    addHandle(filter) {

        const entry = this.getEntrys(filter, false)[0]
        if (!entry) return false;

        return super.addHandle(entry[0])

    }

    /**
     * @override
     */
    removeHandle(filter, handleIndex) {

        const entry = this.getEntrys(filter, false)[0]
        if (!entry) return false;

        return super.removeHandle(entry[0], handleIndex)

    }

    /**
     * @override
     */
    delete(key) {

        if (key in this.data) {

            this.data[key].value.close()
            delete this.data[key];

        }

    }

}

module.exports = DBCache;