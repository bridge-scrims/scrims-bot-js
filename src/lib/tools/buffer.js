
/**
 * @callback AsyncCallback
 * @param { ...any } args
 * @returns { Promise<any> }
 */

class AsyncFunctionBuffer {

    
    constructor(call) {

        /**
         * @type { AsyncCallback }
         */
        this.call = call

        /**
         * @type { any[][] }
         */
        this.queue = []

    }

    async run(...args) {

        this.queue.push(args)
        
        if (this._running) return false;
        this._running = true

        for (const args of this.queue) 
            await this.call(...args).catch(console.error)

        this.queue = []
        this._running = false

    }


}

module.exports = AsyncFunctionBuffer