/**
 * Copyright (c) 2020-present, Goldman Sachs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ApplicationStore } from '@finos/legend-application';
import type { DepotServerClient } from '@finos/legend-server-depot';
import type { LegendTaxonomyApplicationConfig } from '../application/LegendTaxonomyApplicationConfig.js';
import type { LegendTaxonomyPluginManager } from '../application/LegendTaxonomyPluginManager.js';
import type { LegendTaxonomyApplicationPlugin } from './LegendTaxonomyApplicationPlugin.js';
import type { TaxonomyServerClient } from './TaxonomyServerClient.js';

export type LegendTaxonomyApplicationStore = ApplicationStore<
  LegendTaxonomyApplicationConfig,
  LegendTaxonomyApplicationPlugin
>;
export class LegendTaxonomyBaseStore {
  applicationStore: LegendTaxonomyApplicationStore;
  depotServerClient: DepotServerClient;
  taxonomyServerClient: TaxonomyServerClient;
  pluginManager: LegendTaxonomyPluginManager;

  constructor(
    applicationStore: LegendTaxonomyApplicationStore,
    taxonomyServerClient: TaxonomyServerClient,
    depotServerClient: DepotServerClient,
    pluginManager: LegendTaxonomyPluginManager,
  ) {
    this.applicationStore = applicationStore;
    this.taxonomyServerClient = taxonomyServerClient;
    this.depotServerClient = depotServerClient;
    this.pluginManager = pluginManager;

    // Register plugins
    this.taxonomyServerClient.setTracerService(
      this.applicationStore.tracerService,
    );
    this.depotServerClient.setTracerService(
      this.applicationStore.tracerService,
    );
  }
}