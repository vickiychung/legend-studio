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

import { hashArray, type Hashable } from '@finos/legend-shared';
import { CORE_HASH_STRUCTURE } from '../../../../../../../MetaModelConst';
import { InputData } from '../../../mapping/InputData';
import type { PackageableElementReference } from '../../../PackageableElementReference';
import type { Database } from '../model/Database';

export enum RelationalInputType {
  SQL = 'SQL',
  CSV = 'CSV',
}

export class RelationalInputData extends InputData implements Hashable {
  database: PackageableElementReference<Database>;
  data: string;
  inputType: RelationalInputType;

  constructor(
    database: PackageableElementReference<Database>,
    data: string,
    inputType: RelationalInputType,
  ) {
    super();
    this.database = database;
    this.data = data;
    this.inputType = inputType;
  }

  get hashCode(): string {
    return hashArray([
      CORE_HASH_STRUCTURE.RELATIONAL_INPUT_DATA,
      this.database.hashValue,
      this.data,
      this.inputType,
    ]);
  }
}
