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

import {
  collectKeyedCommandConfigEntriesFromConfig,
  LegendApplicationPlugin,
  type KeyedCommandConfigEntry,
  type LegendApplicationPluginManager,
} from '@finos/legend-application';
import packageJson from '../../package.json';
import { QUERY_BUILDER_COMMAND_CONFIG } from '../stores/QueryBuilderCommand.js';
import type { QueryBuilderState } from '../stores/QueryBuilderState.js';

export type CheckEntitlementEditorRender = (
  queryBuilderState: QueryBuilderState,
) => React.ReactNode | undefined;

export class QueryBuilder_LegendApplicationPlugin extends LegendApplicationPlugin {
  static NAME = packageJson.extensions.applicationPlugin;

  constructor() {
    super(QueryBuilder_LegendApplicationPlugin.NAME, packageJson.version);
  }

  install(
    pluginManager: LegendApplicationPluginManager<LegendApplicationPlugin>,
  ): void {
    pluginManager.registerApplicationPlugin(this);
  }

  override getExtraKeyedCommandConfigEntries(): KeyedCommandConfigEntry[] {
    return collectKeyedCommandConfigEntriesFromConfig(
      QUERY_BUILDER_COMMAND_CONFIG,
    );
  }

  getCheckEntitlementsEditorRender(): CheckEntitlementEditorRender | undefined {
    return undefined;
  }
}
