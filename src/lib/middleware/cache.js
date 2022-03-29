const NodeCache = require("node-cache");

class FIFOCache extends NodeCache {

    
    constructor(options) {

        super({ ...options, maxKeys: undefined });
        this.__maxKeys = options.maxKeys || -1;

    }


    // @Overrites
    set(key, value, ttl) {

        // Delete old keys to make room if needed
        if (this.__maxKeys > 0 && this.keys().length >= this.__maxKeys) 
            this.keys().slice(0, this.__maxKeys).forEach(key => this.del(key))

        return super.set(key, value, ttl)

    }


}

module.exports = FIFOCache;