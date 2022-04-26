import { ModalSubmitField, ModalSubmitInteraction } from "discord-modals";
import { CommandInteraction, CommandInteractionOptionResolver, GuildMember, Interaction, MessageComponentInteraction } from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";

import ScrimsUser from "./scrims/user";
import ScrimsJSBot from "./bot";

export interface ScrimsGuildMember extends GuildMember {

    hasPermission(permissionLevel: string, allowedPositions: string[], requiredPositions: string[]): Promise<boolean>;

} 

export interface ScrimsPermissions {

    permissionLevel: string;
    allowedPositions: string[]; 
    requiredPositions: string[];

}

export interface ScrimsInteraction extends Interaction {

    sendModal(modal: Modal, fields?: ModalSubmitField[] ): Promise<void>;

    scrimsUser: ScrimsUser;
    client: ScrimsJSBot; 
    member: ScrimsGuildMember;

}


export interface ScrimsCommandInteraction extends CommandInteraction {

    sendModal(modal: Modal, fields?: ModalSubmitField[] ): Promise<void>;

    scrimsUser: ScrimsUser;
    client: ScrimsJSBot; 
    member: ScrimsGuildMember;

    params: CommandInteractionOptionResolver;
    scrimsCommand: SlashCommandBuilder;
    scrimsPermissions: ScrimsPermissions;

}

export interface ScrimsComponentInteraction extends MessageComponentInteraction {

    sendModal(modal: Modal, fields?: ModalSubmitField[] ): Promise<void>;

    scrimsUser: ScrimsUser;
    client: ScrimsJSBot; 
    member: ScrimsGuildMember;

    memoryData: any;
    commandName: string;
    args: string[];

}

export interface ScrimsModalSubmitInteraction extends ModalSubmitInteraction {

    scrimsUser: ScrimsUser;
    client: ScrimsJSBot; 
    member: ScrimsGuildMember;

    commandName: string;
    args: string[];

}