
import ScrimsJSBot from "./bot";
import { ScrimsInteraction, ScrimsCommandInteraction, ScrimsComponentInteraction, ScrimsModalSubmitInteraction } from './lib/types';
import { ScrimsAutoCompleteInteraction } from './lib_old/types.d';

export interface ScrimsInteraction extends ScrimsInteraction {

    client: ScrimsJSBot;

}

export interface ScrimsAutoCompleteInteraction extends ScrimsAutoCompleteInteraction {

    client: ScrimsJSBot;
    
}

export interface ScrimsCommandInteraction extends ScrimsCommandInteraction {

    client: ScrimsJSBot;

}

export interface ScrimsComponentInteraction extends ScrimsComponentInteraction {

    client: ScrimsJSBot;
    
}

export interface ScrimsModalSubmitInteraction extends ScrimsModalSubmitInteraction {

    client: ScrimsJSBot;
    
}

