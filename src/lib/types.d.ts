import { 
    CommandInteraction, CommandInteractionOptionResolver, ContextMenuInteraction,
    ModalSubmitInteraction, GuildMember, Interaction, MessageComponentInteraction, 
    PartialTextInputData, Modal, AutocompleteInteraction, TextInputComponentOptions,
    MessageOptions, User, MessageReaction, Message
} from "discord.js";

import { SlashCommandBuilder } from "@discordjs/builders";

import ScrimsUserPosition from "./scrims/user_position";
import I18n from "./tools/internationalization";
import ScrimsPosition from "./scrims/position";
import DBClient from "./postgresql/database";
import ScrimsUser from "./scrims/user";
import ScrimsBot from "./bot";
import ScrimsUserPositionsCollection from "./scrims/user_positions";

export interface ScrimsGuildMember extends GuildMember {

    client: ScrimsBot;
    scrimsUser: ScrimsUser;
    id_user: string;

}

export interface InteractionScrimsGuildMember extends ScrimsGuildMember {

    hasPermission(permissionLevel: string, allowedPositions: string[], requiredPositions: string[]): boolean;
    scrimsPositions: ScrimsUserPositionsCollection;

}

export interface ScrimsPermissions {

    permissionLevel: string;
    allowedPositions: string[]; 
    requiredPositions: string[];

}

export interface ScrimsCommandConfiguration {

    forceGuild?: boolean;
    forceScrimsUser?: boolean;
    ephemeralDefer?: boolean;
    bypassBlock?: boolean;
    
}

export interface ScrimsInteraction extends Interaction {

    sendModal(modal: Modal, fields?: PartialTextInputData[] ): Promise<void>;

    i18n: I18n;
    scrimsUser: ScrimsUser;
    client: ScrimsBot; 
    database: DBClient;
    member: InteractionScrimsGuildMember;
    scrimsPositions: ScrimsUserPositionsCollection;

    commandName: string;

}

export class ScrimsMessageReaction extends MessageReaction {

    client: ScrimsBot;
    scrimsUser: ScrimsUser;
    id_user: string;
    user: User;

}

export class ScrimsMessage extends Message {

    client: ScrimsBot;
    scrimsUser: ScrimsUser;
    id_user: string;
    user: User;

}

export interface ScrimsAutoCompleteInteraction extends ScrimsInteraction, AutocompleteInteraction {}
export interface ScrimsContextMenuInteraction extends ScrimsInteraction, ContextMenuInteraction {}

export interface ScrimsCommandInteraction extends ScrimsInteraction, CommandInteraction {

    params: CommandInteractionOptionResolver;
    scrimsCommand: SlashCommandBuilder;
    commandConfig: ScrimsCommandConfiguration;
    scrimsPermissions: ScrimsPermissions;

}

export interface ScrimsComponentInteraction extends ScrimsInteraction, MessageComponentInteraction {

    memoryData: any;
    args: string[];

}

export interface ScrimsModalSubmitInteraction extends ScrimsInteraction, ModalSubmitInteraction {

    args: string[];

}

export interface EphemeralExchangeInputField extends TextInputComponentOptions {

    type: InputType;

}

export interface EphemeralExchangeResponse extends MessageOptions {

    nextOption?: string;
    backOption?: string;
    cancelOption?: string;

}

export type PositionResolvable = string | number | ScrimsPosition;
export type ScrimsUserResolvable = string | ScrimsUser | GuildMember | User;

export type InputType = keyof typeof InputTypes;
export const enum InputTypes {
    TEXT = 1,
    USERS = 2,
    COUNTRY = 3,
    TIME = 4,
    MCACCOUNT = 5
}