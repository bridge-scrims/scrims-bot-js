
const EventEmitter = require("events");

/**
 * @typedef { { value: any, deathTime: number, handels: number[] } } CacheEntry
 */

class BridgeScrimsCache extends EventEmitter {

    
    constructor(defaultTTL=-1, maxKeys=-1) {

        super();

        /**
         * @type { Object.<string, CacheEntry> }
         */
        this.data = {}

        /**
         * @type { number } Default time to live.
         */
        this.defaultTTL = defaultTTL

        /**
         * @type { number } Maximum of keys before cache makes room.
         */
        this.maxKeys = maxKeys

        this.removeExpiredLoop()

    }

    keys() {

        return Object.keys(this.data);

    }

    removeExpiredLoop() {

        this.removeExpired()
        setTimeout(() => this.removeExpiredLoop(), 60*1000)

    }

    getDeathTime(ttl=0) {

        if (!ttl) ttl = this.defaultTTL;
        if (ttl > 0) {

            return Math.round((Date.now()/1000) + ttl);

        }else {

            return null;

        }

    }

    
    get(key) {

        const entry = this.data[key]
        if (!entry) return null;

        if (this.getDeathTime() > entry.deathTime) {

            entry.deathTime = this.getDeathTime()

        }

        return entry.value;

    }


    /**
     * If the entry still has some handels being used then we do not delete it.
     */
    getDeleteable() {

        return Object.entries(this.data).filter(([_, entry]) => entry.handels.length === 0);
    
    }

    removeExpired() {

        const deleteable = this.getDeleteable()
        const expired = deleteable.filter(([_, entry]) => (entry.deathTime !== null) && ((Date.now()/1000) >= entry.deathTime))
        expired.forEach(([key, _]) => this.delete(key))

    }

    delete(key) {

        if (key in this.data) delete this.data[key];

    }

    checkSize() {

        if (this.maxKeys === 0) return false;
        if (this.maxKeys < 0) return true;

        this.removeExpired()

        const difference = Object.keys(this.data).length - this.maxKeys
        if ( difference >= 0 ) {
 
            const deleteable = this.getDeleteable()

            if (deleteable.length < difference) {

                deleteable.forEach(([key, _]) => this.delete(key))
                return false;

            }

            deleteable.slice(difference).forEach(([key, _]) => this.delete(key))

        }

        return true;

    }

    set(key, value, ttl=0, handels=[]) {

        const room = this.checkSize()
        if (!room && handels.length === 0) return false;

        const existing = this.data[key]
        if (existing && existing.handels > 0) return false;

        this.data[key] = { value, deathTime: this.getDeathTime(ttl), handels }

    }

    update(key, value) {

        const entry = this.data[key]
        if (!entry) return false;

        entry.value = value

        if (this.getDeathTime() > entry.deathTime) {

            entry.deathTime = this.getDeathTime()

        }

        return true;

    }

    addHandle(key) {

        const entry = this.data[key]
        if (!entry) return false;

        const index = (entry.handels.slice(-1)[0] ?? 0) + 1
        entry.handels.push(index)

        return index;

    }

    removeHandle(key, handleIndex) {

        const entry = this.data[key]
        if (!entry) return false;

        entry.handels = entry.handels.filter(v => v !== handleIndex)

        // Cache entry no longer has any handels and since the cache is overflowing we remove it
        if (entry.handels.length === 0 && Object.keys(this.data).length >= this.maxKeys) this.delete(key)

    }

}

module.exports = BridgeScrimsCache;