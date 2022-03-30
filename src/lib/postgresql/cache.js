const BridgeScrimsCache = require("../cache");

class DBCache extends BridgeScrimsCache {

    constructor(options) {

        super(options);
        
        this.index = 0

    }

    push(value, ttl) {

        if (value === null) return null;

        this.emit('push', value)

        const entries = this.getEntrys(value)
        if (entries.length > 0) entries.forEach(([ key, _ ]) => this.set( key, value, ttl ))
        else {

            this.set( this.index, value, ttl )
            this.index += 1

        }
        
        return value;

    }

    valuesMatch(obj1, obj2) {

        if (!obj1 || !obj2) return false;
        return Object.entries(obj1).every(([key, value]) => (value instanceof Object) ? this.valuesMatch(value, obj2[key]) : (obj2[key] == value));

    }

    getEntrys(filter={}, invert=false) {
        
        const entries = Object.entries(this.data).map(([ key, value ]) => ([ key, value.v ]))
        
        if (invert) return entries.filter(([ _, value ]) => !this.valuesMatch(filter, value));
        else return entries.filter(([ _, value ]) => this.valuesMatch(filter, value));

    }

    get(filter, invert) {

        const entrys = this.getEntrys(filter, invert)
        return entrys.map(([ _, value ]) => value);

    }

    remove(filter) {

        const entrys = this.getEntrys(filter, false)

        entrys.forEach(([ _, value ]) => this.emit('remove', value))
        entrys.forEach(([ key, _ ]) => this.del(key))

        return entrys.map(([ _, value ]) => value);

    }

    update(newValue, filter) {

        const entries = this.getEntrys(filter, false)
            .map(([ key, oldValue ]) => [ key, { ...oldValue, ...newValue } ])

        entries.forEach(([ _, value ]) => this.emit('update', value))
        entries.forEach(([ key, value ]) => this.set(key, value))

        return true;

    }

}

module.exports = DBCache;