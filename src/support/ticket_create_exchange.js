const { MessageEmbed } = require("discord.js");
const ModalEphemeralExchange = require("../lib/components/modal_exchange");
const ScrimsTicketType = require("../lib/scrims/ticket_type");

/**
 * @param {ScrimsTicketType} type
 */
function getInputFields(type) {

    /** @type {import("../lib/types").EphemeralExchangeInputField[]} */
    const fields = []

    if (type.name === "report") {
        
        fields.push({ 
            type: "USERS", customId: "targets", label: "Who are you reporting?", 
            maxLength: 1024, minLength: 3, placeholder: "@FirstUser#1188 @SecondUser#2299 ...", 
            required: true, style: "SHORT" 
        })

    }

    const reasonFieldLabel = (type.name === "report") ? "What are you reporting them for?" : "What can we help you with?"
    fields.push({ 
        type: "TEXT", customId: "reason", label: reasonFieldLabel, maxLength: 1024, 
        minLength: 6, placeholder: "Write here", required: true, style: "PARAGRAPH" 
    })
    
    return fields;

}

class TicketCreateExchange extends ModalEphemeralExchange {

    /**
     * @param {import('../bot')} client
     * @param {ScrimsTicketType} type 
     */
    constructor(client, guild, creator, type, categoryId, onFinish) {

        super(client, guild, creator, `${type.capitalizedName} Ticket`, getInputFields(type), (...args) => this._getResponsePayload(...args), onFinish);

        /** @type {import('../bot')} */
        this.client
        
        /** @type {ScrimsTicketType} */
        this.ticketType = type
        
        this.categoryId = categoryId

    } 

    isTest() {

        return (this.getValue("reason") === "testing the ticket system without pinging the bridge scrims support team")
            || (this.getValue("reason") === "testing the ticket system without pinging support");
        
    }

    isNiteBlock() {

        return (this.getValue("reason").includes("alpha") || this.getValue("reason").includes("testing") || this.getValue("reason").includes("tester"));

    }

    /** @param {MessageEmbed} embed */
    _getResponsePayload(embed, fields, currentIndex) {

        if (currentIndex === -1) return { content: "Ticket creation process was forcibly aborted.", embeds: [] }

        embed.setTitle(`Ticket Create Confirmation`)
        embed.setDescription(`Please verify that all fields are filled to your liking, then create this ticket using the button below.`)
        embed.setColor('#ffffff')

        const content = (this.isTest() ? ' *(Test ticket detected)*' : null)
        return { content, embeds: [embed] };

    }

}

module.exports = TicketCreateExchange;