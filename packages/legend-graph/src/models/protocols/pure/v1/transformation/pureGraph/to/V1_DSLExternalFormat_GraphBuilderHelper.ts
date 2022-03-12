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
  getSchemaSet,
  getBinding,
} from '../../../../../../../graphManager/DSLExternalFormat_GraphManagerHelper';
import type { PackageableElementImplicitReference } from '../../../../../../metamodels/pure/packageableElements/PackageableElementReference';
import type { SchemaSet } from '../../../../../../metamodels/pure/packageableElements/externalFormat/schemaSet/SchemaSet';
import type { Binding } from '../../../../../../metamodels/pure/packageableElements/externalFormat/store/Binding';
import type { V1_GraphBuilderContext } from './V1_GraphBuilderContext';

export const V1_resolveSchemaSet = (
  path: string,
  context: V1_GraphBuilderContext,
): PackageableElementImplicitReference<SchemaSet> =>
  context.createImplicitPackageableElementReference(path, (_path: string) =>
    getSchemaSet(_path, context.graph),
  );

export const V1_resolveBinding = (
  path: string,
  context: V1_GraphBuilderContext,
): PackageableElementImplicitReference<Binding> =>
  context.createImplicitPackageableElementReference(path, (_path: string) =>
    getBinding(_path, context.graph),
  );