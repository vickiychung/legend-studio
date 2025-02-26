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

import { observer } from 'mobx-react-lite';
import { flowResult } from 'mobx';
import { useApplicationStore } from '@finos/legend-application';
import {
  AssistantIcon,
  clsx,
  HammerIcon,
  TerminalIcon,
} from '@finos/legend-art';
import { useEditorStore } from './EditorStoreProvider.js';
import { FileEditorState } from '../../stores/FileEditorState.js';

const FileEditorStatusBar = observer(
  (props: { fileEditorState: FileEditorState }) => {
    const { fileEditorState } = props;
    const currentCursorInfo = fileEditorState.textEditorState.cursorObserver;
    const selectionLength = currentCursorInfo?.selection
      ? fileEditorState.textEditorState.model.getValueInRange(
          currentCursorInfo.selection,
        ).length
      : 0;

    // actions
    const goToLine = (): void => fileEditorState.setShowGoToLinePrompt(true);

    return (
      <div className="file-editor__status-bar">
        {currentCursorInfo?.position && (
          <button
            className="editor__status-bar__action file-editor__status-bar__cursor-info"
            onClick={goToLine}
            tabIndex={-1}
            title="Go to Line/Column"
          >
            {`Ln ${currentCursorInfo.position.lineNumber}, Col ${
              currentCursorInfo.position.column
            } ${selectionLength ? ` (${selectionLength} selected)` : ''}`}
          </button>
        )}
      </div>
    );
  },
);

export const StatusBar = observer(() => {
  const editorStore = useEditorStore();
  const applicationStore = useApplicationStore();

  // actions
  const toggleAuxPanel = (): void => editorStore.auxPanelDisplayState.toggle();
  const executeGo = (): void => {
    flowResult(editorStore.executeGo()).catch(
      applicationStore.alertUnhandledError,
    );
  };
  const toggleAssistant = (): void =>
    applicationStore.assistantService.toggleAssistant();

  return (
    <div className="editor__status-bar">
      <div className="editor__status-bar__left">
        <div className="editor__status-bar__workspace"></div>
      </div>
      <div className="editor__status-bar__right">
        {editorStore.tabManagerState.currentTab instanceof FileEditorState && (
          <FileEditorStatusBar
            fileEditorState={editorStore.tabManagerState.currentTab}
          />
        )}
        <button
          className={clsx(
            'editor__status-bar__action editor__status-bar__compile-btn',
            {
              'editor__status-bar__compile-btn--wiggling':
                editorStore.executionState.isInProgress,
            },
          )}
          disabled={
            editorStore.initState.isInInitialState ||
            editorStore.executionState.isInProgress
          }
          onClick={executeGo}
          tabIndex={-1}
          title="Execute (F9)"
        >
          <HammerIcon />
        </button>
        <button
          className={clsx(
            'editor__status-bar__action editor__status-bar__action__toggler',
            {
              'editor__status-bar__action__toggler--active': Boolean(
                editorStore.auxPanelDisplayState.isOpen,
              ),
            },
          )}
          onClick={toggleAuxPanel}
          tabIndex={-1}
          title="Toggle auxiliary panel"
        >
          <TerminalIcon />
        </button>
        <button
          className={clsx(
            'editor__status-bar__action editor__status-bar__action__toggler',
            {
              'editor__status-bar__action__toggler--active':
                !applicationStore.assistantService.isHidden,
            },
          )}
          onClick={toggleAssistant}
          tabIndex={-1}
          title="Toggle assistant"
        >
          <AssistantIcon />
        </button>
      </div>
    </div>
  );
});
