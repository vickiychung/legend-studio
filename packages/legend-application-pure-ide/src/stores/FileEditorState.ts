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
  type CommandRegistrar,
  EDITOR_LANGUAGE,
  TAB_SIZE,
  type TabState,
} from '@finos/legend-application';
import {
  clearMarkers,
  setErrorMarkers,
  type TextEditorPosition,
} from '@finos/legend-art';
import { DIRECTORY_PATH_DELIMITER } from '@finos/legend-graph';
import {
  assertErrorThrown,
  getNullableLastElement,
  guaranteeNonNullable,
  IllegalStateError,
  type GeneratorFn,
} from '@finos/legend-shared';
import { action, flow, flowResult, makeObservable, observable } from 'mobx';
import { editor as monacoEditorAPI } from 'monaco-editor';
import { ConceptType } from '../server/models/ConceptTree.js';
import {
  FileCoordinate,
  type File,
  trimPathLeadingSlash,
  type FileErrorCoordinate,
} from '../server/models/File.js';
import {
  type ConceptInfo,
  FIND_USAGE_FUNCTION_PATH,
} from '../server/models/Usage.js';
import type { EditorStore } from './EditorStore.js';
import { EditorTabState } from './EditorTabManagerState.js';
import { LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY } from './LegendPureIDECommand.js';

const getFileEditorLanguage = (filePath: string): string => {
  const extension = getNullableLastElement(filePath.split('.'));
  switch (extension) {
    case 'pure':
      return EDITOR_LANGUAGE.PURE;
    case 'json':
      return EDITOR_LANGUAGE.JSON;
    case 'sql':
      return EDITOR_LANGUAGE.SQL;
    case 'md':
      return EDITOR_LANGUAGE.MARKDOWN;
    case 'java':
      return EDITOR_LANGUAGE.JAVA;
    default:
      return EDITOR_LANGUAGE.TEXT;
  }
};

class FileTextEditorState {
  readonly model: monacoEditorAPI.ITextModel;

  editor?: monacoEditorAPI.IStandaloneCodeEditor | undefined;
  language!: string;
  viewState?: monacoEditorAPI.ICodeEditorViewState | undefined;

  forcedCursorPosition: TextEditorPosition | undefined;
  wrapText = false;

  constructor(fileEditorState: FileEditorState) {
    makeObservable(this, {
      viewState: observable.ref,
      editor: observable.ref,
      forcedCursorPosition: observable.ref,
      wrapText: observable,
      setViewState: action,
      setEditor: action,
      setForcedCursorPosition: action,
      setWrapText: action,
    });

    this.language = getFileEditorLanguage(fileEditorState.filePath);
    this.model = monacoEditorAPI.createModel(
      fileEditorState.uuid,
      this.language,
    );
    this.model.updateOptions({ tabSize: TAB_SIZE });
  }

  setViewState(val: monacoEditorAPI.ICodeEditorViewState | undefined): void {
    this.viewState = val;
  }

  setEditor(val: monacoEditorAPI.IStandaloneCodeEditor | undefined): void {
    this.editor = val;
  }

  setForcedCursorPosition(val: TextEditorPosition | undefined): void {
    this.forcedCursorPosition = val;
  }

  setWrapText(val: boolean): void {
    const oldVal = this.wrapText;
    this.wrapText = val;
    if (oldVal !== val && this.editor) {
      this.editor.updateOptions({
        wordWrap: val ? 'on' : 'off',
      });
      this.editor.focus();
    }
  }
}

export class FileEditorRenameConceptState {
  readonly fileEditorState: FileEditorState;
  readonly concept: ConceptInfo;
  readonly coordinate: FileCoordinate;

  constructor(
    fileEditorState: FileEditorState,
    concept: ConceptInfo,
    coordiate: FileCoordinate,
  ) {
    this.fileEditorState = fileEditorState;
    this.concept = concept;
    this.coordinate = coordiate;
  }
}

export class FileEditorState
  extends EditorTabState
  implements CommandRegistrar
{
  readonly filePath: string;
  readonly textEditorState!: FileTextEditorState;

  file: File;
  renameConceptState: FileEditorRenameConceptState | undefined;

  constructor(editorStore: EditorStore, file: File, filePath: string) {
    super(editorStore);

    makeObservable(this, {
      file: observable,
      renameConceptState: observable,
      setFile: action,
      setConceptToRenameState: flow,
    });

    this.file = file;
    this.filePath = filePath;
    this.textEditorState = new FileTextEditorState(this);
  }

  get label(): string {
    return trimPathLeadingSlash(this.filePath);
  }

  override get description(): string | undefined {
    return `File: ${trimPathLeadingSlash(this.filePath)}`;
  }

  get fileName(): string {
    return guaranteeNonNullable(
      getNullableLastElement(this.filePath.split(DIRECTORY_PATH_DELIMITER)),
    );
  }

  override match(tab: TabState): boolean {
    return tab instanceof FileEditorState && this.filePath === tab.filePath;
  }

  override onClose(): void {
    // dispose text model to avoid memory leak
    this.textEditorState.model.dispose();
  }

  setFile(value: File): void {
    this.file = value;
  }

  *setConceptToRenameState(
    coordinate: FileCoordinate | undefined,
  ): GeneratorFn<void> {
    if (!coordinate) {
      this.renameConceptState = undefined;
      return;
    }
    const concept = (yield this.editorStore.getConceptInfo(coordinate)) as
      | ConceptInfo
      | undefined;
    this.renameConceptState = concept
      ? new FileEditorRenameConceptState(this, concept, coordinate)
      : undefined;
  }

  showError(coordinate: FileErrorCoordinate): void {
    setErrorMarkers(
      this.textEditorState.model,
      [
        {
          message: coordinate.error.message,
          startLineNumber: coordinate.line,
          startColumn: coordinate.column,
          endLineNumber: coordinate.line,
          endColumn: coordinate.column,
        },
      ],
      this.uuid,
    );
  }

  clearError(): void {
    clearMarkers(this.uuid);
  }

  registerCommands(): void {
    if (this.textEditorState.language !== EDITOR_LANGUAGE.PURE) {
      throw new IllegalStateError(
        `File editor commands should only be used for Pure files`,
      );
    }
    this.editorStore.applicationStore.commandCenter.registerCommand({
      key: LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.GO_TO_DEFINITION,
      trigger: () => Boolean(this.textEditorState.editor?.hasTextFocus()),
      action: () => {
        const currentPosition = this.textEditorState.editor?.getPosition();
        if (currentPosition) {
          flowResult(
            this.editorStore.executeNavigation(
              new FileCoordinate(
                this.filePath,
                currentPosition.lineNumber,
                currentPosition.column,
              ),
            ),
          ).catch(this.editorStore.applicationStore.alertUnhandledError);
        }
      },
    });
    this.editorStore.applicationStore.commandCenter.registerCommand({
      key: LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.GO_BACK,
      action: () => {
        flowResult(this.editorStore.navigateBack()).catch(
          this.editorStore.applicationStore.alertUnhandledError,
        );
      },
    });
    this.editorStore.applicationStore.commandCenter.registerCommand({
      key: LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.REVEAL_CONCEPT_IN_TREE,
      trigger: () => Boolean(this.textEditorState.editor?.hasTextFocus()),
      action: () => {
        const currentPosition = this.textEditorState.editor?.getPosition();
        if (currentPosition) {
          this.editorStore
            .revealConceptInTree(
              new FileCoordinate(
                this.filePath,
                currentPosition.lineNumber,
                currentPosition.column,
              ),
            )
            .catch(this.editorStore.applicationStore.alertUnhandledError);
        }
      },
    });
    this.editorStore.applicationStore.commandCenter.registerCommand({
      key: LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.FIND_USAGES,
      trigger: () => Boolean(this.textEditorState.editor?.hasTextFocus()),
      action: () => {
        const currentPosition = this.textEditorState.editor?.getPosition();
        if (currentPosition) {
          const coordinate = new FileCoordinate(
            this.filePath,
            currentPosition.lineNumber,
            currentPosition.column,
          );
          flowResult(this.editorStore.findUsages(coordinate)).catch(
            this.editorStore.applicationStore.alertUnhandledError,
          );
        }
      },
    });
    this.editorStore.applicationStore.commandCenter.registerCommand({
      key: LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.RENAME_CONCEPT,
      trigger: () => Boolean(this.textEditorState.editor?.hasTextFocus()),
      action: () => {
        const currentPosition = this.textEditorState.editor?.getPosition();
        if (currentPosition) {
          const coordinate = new FileCoordinate(
            this.filePath,
            currentPosition.lineNumber,
            currentPosition.column,
          );
          flowResult(this.setConceptToRenameState(coordinate)).catch(
            this.editorStore.applicationStore.alertUnhandledError,
          );
        }
      },
    });
  }

  async renameConcept(newName: string): Promise<void> {
    if (!this.renameConceptState) {
      return;
    }
    const concept = this.renameConceptState.concept;
    try {
      this.editorStore.applicationStore.setBlockingAlert({
        message: 'Finding concept usages...',
        showLoading: true,
      });
      const usages = await this.editorStore.findConceptUsages(
        concept.pureType === ConceptType.ENUM_VALUE
          ? FIND_USAGE_FUNCTION_PATH.ENUM
          : concept.pureType === ConceptType.PROPERTY ||
            concept.pureType === ConceptType.QUALIFIED_PROPERTY
          ? FIND_USAGE_FUNCTION_PATH.PROPERTY
          : FIND_USAGE_FUNCTION_PATH.ELEMENT,
        (concept.owner ? [`'${concept.owner}'`] : []).concat(
          `'${concept.path}'`,
        ),
      );
      await flowResult(
        this.editorStore.renameConcept(
          concept.pureName,
          newName,
          concept.pureType,
          usages,
        ),
      );
      this.textEditorState.setForcedCursorPosition({
        lineNumber: this.renameConceptState.coordinate.line,
        column: this.renameConceptState.coordinate.column,
      });
    } catch (error) {
      assertErrorThrown(error);
      this.editorStore.applicationStore.notifyError(error);
    } finally {
      this.editorStore.applicationStore.setBlockingAlert(undefined);
    }
  }

  deregisterCommands(): void {
    if (this.textEditorState.language !== EDITOR_LANGUAGE.PURE) {
      throw new IllegalStateError(
        `File editor commands should only be used for Pure files`,
      );
    }
    [
      LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.GO_TO_DEFINITION,
      LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.GO_BACK,
      LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.REVEAL_CONCEPT_IN_TREE,
      LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.FIND_USAGES,
      LEGEND_PURE_IDE_PURE_FILE_EDITOR_COMMAND_KEY.RENAME_CONCEPT,
    ].forEach((key) =>
      this.editorStore.applicationStore.commandCenter.deregisterCommand(key),
    );
  }
}
