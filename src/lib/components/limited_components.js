
class LimitedComponentContainer {

    constructor(client) {

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @type { import('../bot') }
         * @readonly
         */
        this.client

        this.timeouts = {}
        this.components = []

    }

    add(component, timeout) {

        this.components.push(component)

        this.client.handles.push(component.customId)
        setTimeout(() => this.releaseHandle(component.customId), 5*60*1000)
        
        this.timeouts[component.customId] = setTimeout(() => this.destroy(component.customId), timeout)

    }

    releaseHandle(customId) {

        this.client.handles = this.client.handles.filter(v => v !== customId)

    }

    destroy(customId) {

        if (this.timeouts[customId]) clearTimeout(this.timeouts[customId])
        delete this.timeouts[customId]
        
        this.releaseHandle(customId)

        this.components = this.components.filter(component => component.customId !== customId)

    }

    getHandler(id) {

        return this.components
            .filter(component => component.customId === id)
            .map(component => (async interaction => component.onInteract(interaction)))[0]

    }

    destroyMessage(message) {

        if (message?.components) {

            message.components.map(actionRow => actionRow.components).flat().forEach(component => this.destroy(component.customId))

        } 

    }

}

module.exports = LimitedComponentContainer;