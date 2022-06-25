
import ScrimsJSBot from "./bot";
import { ScrimsInteraction, ScrimsCommandInteraction, ScrimsComponentInteraction, ScrimsModalSubmitInteraction, ScrimsAutoCompleteInteraction } from './lib/types';

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

