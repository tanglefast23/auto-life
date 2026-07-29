import rawRates from '../../content/rates.json';
import { RatesSchema, type RatesConfig } from './content-schemas';

/**
 * The one runtime import path for content. Raw JSON is parsed exactly once here;
 * everything else (runtime and tests alike) imports the typed result.
 * New content files register here — never in a second, tests-only list.
 */
export interface ContentRegistry {
  rates: RatesConfig;
}

export const content: ContentRegistry = {
  rates: RatesSchema.parse(rawRates),
};
