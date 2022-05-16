import { 
    CommandInteraction, CommandInteractionOptionResolver, ContextMenuInteraction,
    ModalSubmitInteraction, GuildMember, Interaction, MessageComponentInteraction, PartialTextInputData, Modal 
} from "discord.js";

import { SlashCommandBuilder } from "@discordjs/builders";

import ScrimsUser from "./scrims/user";
import ScrimsCouncilBot from "./bot";
import I18n from "./Internationalization";

export interface ScrimsGuildMember extends GuildMember {

    hasPermission(permissionLevel: string, allowedPositions: string[], requiredPositions: string[]): Promise<boolean>;

} 

export interface ScrimsPermissions {

    permissionLevel: string;
    allowedPositions: string[]; 
    requiredPositions: string[];

}

export interface ScrimsInteraction extends Interaction {

    sendModal(modal: Modal, fields?: PartialTextInputData[] ): Promise<void>;

    i18n: I18n;
    scrimsUser: ScrimsUser;
    client: ScrimsCouncilBot; 
    member: ScrimsGuildMember;

    commandName: string;

}

export interface ScrimsContextMenuInteraction extends ContextMenuInteraction, ScrimsInteraction {}

export interface ScrimsCommandInteraction extends ScrimsInteraction, CommandInteraction {

    params: CommandInteractionOptionResolver;
    scrimsCommand: SlashCommandBuilder;
    scrimsPermissions: ScrimsPermissions;

}

export interface ScrimsComponentInteraction extends MessageComponentInteraction, ScrimsInteraction {

    memoryData: any;
    args: string[];

}

export interface ScrimsModalSubmitInteraction extends ModalSubmitInteraction, ScrimsInteraction {

    args: string[];

}