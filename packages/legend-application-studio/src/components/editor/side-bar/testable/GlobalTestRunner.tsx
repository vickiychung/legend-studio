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

import { EDITOR_LANGUAGE, TextInputEditor } from '@finos/legend-application';
import {
  type TreeData,
  type TreeNodeContainerProps,
  clsx,
  PanelLoadingIndicator,
  PlayIcon,
  TreeView,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshIcon,
  TimesCircleIcon,
  CheckCircleIcon,
  ContextMenu,
  MenuContent,
  MenuContentItem,
  Dialog,
  WarningIcon,
  CircleNotchIcon,
  EmptyCircleIcon,
  PanelContent,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalFooterButton,
  Panel,
  PanelHeader,
} from '@finos/legend-art';
import {
  AssertFail,
  AssertionStatus,
  EqualToJsonAssertFail,
  PackageableElement,
  TestError,
} from '@finos/legend-graph';
import {
  type GeneratorFn,
  isNonNullable,
  prettyCONSTName,
  toTitleCase,
} from '@finos/legend-shared';
import { observer } from 'mobx-react-lite';
import { forwardRef, useEffect, useState } from 'react';
import { GLOBAL_TEST_RUNNER_TABS } from '../../../../stores/EditorConfig.js';
import {
  type TestableExplorerTreeNodeData,
  type GlobalTestRunnerState,
  type TestableState,
  TESTABLE_RESULT,
  AtomicTestTreeNodeData,
  AssertionTestTreeNodeData,
  TestableTreeNodeData,
  TestTreeNodeData,
  getNodeTestableResult,
  getAtomicTest_TestResult,
  getAssertionStatus,
} from '../../../../stores/sidebar-state/testable/GlobalTestRunnerState.js';
import type { STO_ProjectOverview_LegendStudioApplicationPlugin_Extension } from '../../../../stores/STO_ProjectOverview_LegendStudioApplicationPlugin_Extension.js';
import { LEGEND_STUDIO_TEST_ID } from '../../../LegendStudioTestID.js';
import { TextDiffView } from '../../../shared/DiffView.js';
import { getElementTypeIcon } from '../../../shared/ElementIconUtils.js';
import { UnsupportedEditorPanel } from '../../edit-panel/UnsupportedElementEditor.js';
import { useEditorStore } from '../../EditorStoreProvider.js';

export const getTestableResultIcon = (
  testableResult: TESTABLE_RESULT,
): React.ReactNode => {
  switch (testableResult) {
    case TESTABLE_RESULT.PASSED:
      return (
        <div
          title="Test passed"
          className="global-test-runner__item__link__content__status__indicator global-test-runner__item__link__content__status__indicator--succeeded"
        >
          <CheckCircleIcon />
        </div>
      );
    case TESTABLE_RESULT.IN_PROGRESS:
      return (
        <div
          title="Test is running"
          className="global-test-runner__item__link__content__status__indicator workflow-manager__item__link__content__status__indicator--in-progress"
        >
          <CircleNotchIcon />
        </div>
      );
    case TESTABLE_RESULT.FAILED:
      return (
        <div
          title="Test Failed"
          className="global-test-runner__item__link__content__status__indicator global-test-runner__item__link__content__status__indicator--failed"
        >
          <TimesCircleIcon />
        </div>
      );
    case TESTABLE_RESULT.ERROR:
      return (
        <div
          title="Test has an error"
          className="global-test-runner__item__link__content__status__indicator global-test-runner__item__link__content__status__indicator--failed"
        >
          <WarningIcon />
        </div>
      );
    default:
      return (
        <div
          title="Test did not run"
          className="global-test-runner__item__link__content__status__indicator global-test-runner__item__link__content__status__indicator--unknown"
        >
          <EmptyCircleIcon />
        </div>
      );
  }
};
const getOptionalError = (
  node: TestableExplorerTreeNodeData,
  testableState: TestableState,
): TestError | AssertFail | Map<string, AssertFail> | undefined => {
  if (node instanceof AtomicTestTreeNodeData) {
    const result = getAtomicTest_TestResult(
      node.atomicTest,
      testableState.results,
    );
    if (result instanceof TestError) {
      return result;
    }
  } else if (node instanceof AssertionTestTreeNodeData) {
    const status = getAssertionStatus(node.assertion, testableState.results);
    if (status instanceof AssertFail) {
      return status;
    } else if (status && !(status instanceof AssertionStatus)) {
      const errorState = new Map<string, AssertFail>();
      Array.from(status.entries()).forEach(([key, assertionStatus]) => {
        if (assertionStatus instanceof AssertFail) {
          errorState.set(key, assertionStatus);
        }
      });
      return errorState;
    }
  }
  return undefined;
};

const TestFailViewer = observer(
  (props: {
    globalTestRunnerState: GlobalTestRunnerState;
    failure: TestError | AssertFail;
  }) => {
    const { globalTestRunnerState, failure } = props;
    const id =
      failure instanceof TestError
        ? failure.atomicTest.id
        : failure.assertion.id;
    const closeLogViewer = (): void =>
      globalTestRunnerState.setFailureViewing(undefined);

    return (
      <Dialog
        open={Boolean(failure)}
        onClose={closeLogViewer}
        classes={{
          root: 'editor-modal__root-container',
          container: 'editor-modal__container',
          paper: 'editor-modal__content',
        }}
      >
        <Modal darkMode={true} className="editor-modal">
          <PanelLoadingIndicator
            isLoading={globalTestRunnerState.isDispatchingAction}
          />
          <ModalHeader title={id} />
          <ModalBody>
            {failure instanceof TestError && (
              <TextInputEditor
                inputValue={failure.error}
                isReadOnly={true}
                language={EDITOR_LANGUAGE.TEXT}
                showMiniMap={true}
              />
            )}
            {failure instanceof EqualToJsonAssertFail && (
              <TextDiffView
                language={EDITOR_LANGUAGE.JSON}
                from={failure.expected}
                to={failure.actual}
              />
            )}
            {failure instanceof AssertFail &&
              !(failure instanceof EqualToJsonAssertFail) && (
                <TextInputEditor
                  inputValue={failure.message ?? ''}
                  isReadOnly={true}
                  language={EDITOR_LANGUAGE.TEXT}
                />
              )}
          </ModalBody>
          <ModalFooter>
            <ModalFooterButton text="Close" onClick={closeLogViewer} />
          </ModalFooter>
        </Modal>
      </Dialog>
    );
  },
);

const TestableExplorerContextMenu = observer(
  forwardRef<
    HTMLDivElement,
    {
      globalTestRunnerState: GlobalTestRunnerState;
      testableState: TestableState;
      node: TestableExplorerTreeNodeData;
      treeData: TreeData<TestableExplorerTreeNodeData>;
      error?: TestError | AssertFail | Map<string, AssertFail> | undefined;
    }
  >(function TestableExplorerContextMenu(props, ref) {
    const { node, error, globalTestRunnerState, testableState } = props;
    const runTest = (): void => {
      testableState.run(node);
    };
    const viewError = (err: TestError | AssertFail): void =>
      globalTestRunnerState.setFailureViewing(err);
    return (
      <MenuContent data-testid={LEGEND_STUDIO_TEST_ID.EXPLORER_CONTEXT_MENU}>
        <MenuContentItem
          disabled={globalTestRunnerState.isDispatchingAction}
          onClick={runTest}
        >
          Run
        </MenuContentItem>
        {error &&
          (error instanceof TestError || error instanceof AssertFail) && (
            <MenuContentItem onClick={(): void => viewError(error)}>
              {error instanceof TestError ? 'View Error' : 'View assert fail'}
            </MenuContentItem>
          )}
        {error &&
          !(error instanceof TestError || error instanceof AssertFail) &&
          Array.from(error.entries()).map(([key, testError]) => (
            <MenuContentItem
              key={key}
              onClick={(): void => viewError(testError)}
            >
              {testError instanceof TestError
                ? `View Error for ${key}`
                : `View assert fail for ${key}`}
            </MenuContentItem>
          ))}
      </MenuContent>
    );
  }),
);

const TestableTreeNodeContainer: React.FC<
  TreeNodeContainerProps<
    TestableExplorerTreeNodeData,
    {
      globalTestRunnerState: GlobalTestRunnerState;
      testableState: TestableState;
      treeData: TreeData<TestableExplorerTreeNodeData>;
    }
  >
> = (props) => {
  const { node, level, stepPaddingInRem, onNodeSelect } = props;
  const { treeData, testableState, globalTestRunnerState } = props.innerProps;
  const editorStore = useEditorStore();
  const results = testableState.results;
  const expandIcon =
    node instanceof AssertionTestTreeNodeData ? (
      <div />
    ) : node.isOpen ? (
      <ChevronDownIcon />
    ) : (
      <ChevronRightIcon />
    );
  const nodeIcon =
    node instanceof TestableTreeNodeData
      ? node.testableMetadata.testable instanceof PackageableElement
        ? getElementTypeIcon(
            editorStore,
            editorStore.graphState.getPackageableElementType(
              node.testableMetadata.testable,
            ),
          )
        : null
      : null;
  const resultIcon = getTestableResultIcon(
    getNodeTestableResult(
      node,
      testableState.globalTestRunnerState.isRunningTests.isInProgress,
      results,
    ),
  );
  const optionalError = getOptionalError(node, testableState);
  // );
  const selectNode: React.MouseEventHandler = (event) => onNodeSelect?.(node);

  return (
    <ContextMenu
      content={
        <TestableExplorerContextMenu
          globalTestRunnerState={globalTestRunnerState}
          testableState={testableState}
          treeData={treeData}
          node={node}
          error={optionalError}
        />
      }
      menuProps={{ elevation: 7 }}
    >
      <div
        className={clsx(
          'tree-view__node__container global-test-runner__explorer__testable-tree__node__container',
        )}
        onClick={selectNode}
        style={{
          paddingLeft: `${level * (stepPaddingInRem ?? 1)}rem`,
          display: 'flex',
        }}
      >
        <div className="tree-view__node__icon global-test-runner__explorer__testable-tree__node__icon">
          <div className="global-test-runner__explorer__testable-tree__node__icon__expand">
            {expandIcon}
          </div>
          <div className="global-test-runner__explorer__testable-tree__node__icon__type">
            {resultIcon}
          </div>
          {nodeIcon && (
            <div className="global-test-runner__explorer__testable-tree__node__result__icon__type">
              {nodeIcon}
            </div>
          )}
        </div>
        {node instanceof TestableTreeNodeData && (
          <div className="global-test-runner__item__link__content">
            <span className="global-test-runner__item__link__content__id">
              {node.testableMetadata.name}
            </span>
          </div>
        )}
        {node instanceof TestTreeNodeData && (
          <div className="global-test-runner__item__link__content">
            <span className="global-test-runner__item__link__content__id">
              {node.label}
            </span>
          </div>
        )}
        {node instanceof AssertionTestTreeNodeData && (
          <div className="global-test-runner__item__link__content">
            <span className="global-test-runner__item__link__content__id">
              {node.label}
            </span>
          </div>
        )}
      </div>
    </ContextMenu>
  );
};

// TODO:
// - Handle Multi Execution Test Results
// - Add `Visit Test` to open test editors when Testable Editors are complete
export const GlobalTestRunner = observer(
  (props: { globalTestRunnerState: GlobalTestRunnerState }) => {
    const editorStore = useEditorStore();
    const globalTestRunnerState = props.globalTestRunnerState;
    const isDispatchingAction = globalTestRunnerState.isDispatchingAction;
    const sdlcState = editorStore.sdlcState;
    const currentWorkspace = sdlcState.currentWorkspace;
    const plugins = editorStore.pluginManager.getApplicationPlugins();
    const testRunnerTabs = (Object.values(GLOBAL_TEST_RUNNER_TABS) as string[])
      .concat(
        plugins.flatMap(
          (plugin) =>
            (
              plugin as STO_ProjectOverview_LegendStudioApplicationPlugin_Extension
            ).getExtraTestRunnerTabsClassifiers?.() ?? [],
        ),
      )
      .map((e) => ({
        value: e,
        label: prettyCONSTName(e),
      }));

    const [selectedTab, setSelectedTab] = useState(
      GLOBAL_TEST_RUNNER_TABS.GLOBAL_TEST_RUNNER.valueOf(),
    );

    const changeTab = (tab: string): void => {
      setSelectedTab(tab);
    };

    const renderTestables = (): React.ReactNode => (
      <>
        {(globalTestRunnerState.testableStates ?? []).map((testableState) => {
          const onNodeSelect = (node: TestableExplorerTreeNodeData): void => {
            testableState.onTreeNodeSelect(node, testableState.treeData);
          };
          const getChildNodes = (
            node: TestableExplorerTreeNodeData,
          ): TestableExplorerTreeNodeData[] => {
            if (node.childrenIds) {
              return node.childrenIds
                .map((id) => testableState.treeData.nodes.get(id))
                .filter(isNonNullable);
            }
            return [];
          };
          return (
            <TreeView
              components={{
                TreeNodeContainer: TestableTreeNodeContainer,
              }}
              key={testableState.uuid}
              treeData={testableState.treeData}
              onNodeSelect={onNodeSelect}
              getChildNodes={getChildNodes}
              innerProps={{
                globalTestRunnerState,
                testableState,
                treeData: testableState.treeData,
              }}
            />
          );
        })}
      </>
    );

    useEffect(() => {
      editorStore.globalTestRunnerState.init();
    }, [editorStore.globalTestRunnerState]);

    const runAllTests = (): GeneratorFn<void> =>
      globalTestRunnerState.runAllTests(undefined);

    const reset = (): void => globalTestRunnerState.init(true);

    const renderTestRunnerTab = (): React.ReactNode => {
      if (
        selectedTab === GLOBAL_TEST_RUNNER_TABS.GLOBAL_TEST_RUNNER.valueOf()
      ) {
        return (
          <div
            data-testid={LEGEND_STUDIO_TEST_ID.GLOBAL_TEST_RUNNER}
            className="panel global-test-runner"
          >
            <PanelHeader className="panel__header side-bar__header">
              <div className="panel__header__title global-test-runner__header__title">
                <div className="panel__header__title__content side-bar__header__title__content">
                  GLOBAL TEST RUNNER
                </div>
              </div>
              <div className="panel__header__actions side-bar__header__actions">
                <button
                  className={clsx(
                    'panel__header__action side-bar__header__action global-test-runner__refresh-btn',
                    {
                      'global-test-runner__refresh-btn--loading':
                        isDispatchingAction,
                    },
                  )}
                  disabled={isDispatchingAction}
                  onClick={reset}
                  tabIndex={-1}
                  title="Run All Tests"
                >
                  <RefreshIcon />
                </button>
                <button
                  className="panel__header__action side-bar__header__action global-test-runner__refresh-btn"
                  disabled={isDispatchingAction}
                  onClick={runAllTests}
                  tabIndex={-1}
                  title="Run All Tests"
                >
                  <PlayIcon />
                </button>
              </div>
            </PanelHeader>
            <PanelContent className="side-bar__content">
              <PanelLoadingIndicator isLoading={isDispatchingAction} />
              <Panel className="side-bar__panel">
                <PanelHeader>
                  <div className="panel__header__title">
                    <div className="panel__header__title__content">
                      TESTABLES
                    </div>
                  </div>
                  <div
                    className="side-bar__panel__header__changes-count"
                    data-testid={
                      LEGEND_STUDIO_TEST_ID.SIDEBAR_PANEL_HEADER__CHANGES_COUNT
                    }
                  >
                    {globalTestRunnerState.testableStates?.length ?? '0'}
                  </div>
                </PanelHeader>
                <PanelContent>{renderTestables()}</PanelContent>
                {globalTestRunnerState.failureViewing && (
                  <TestFailViewer
                    globalTestRunnerState={globalTestRunnerState}
                    failure={globalTestRunnerState.failureViewing}
                  />
                )}
              </Panel>
            </PanelContent>
          </div>
        );
      } else {
        const extraTestRunnerTabEditorRenderers = plugins.flatMap(
          (plugin) =>
            (
              plugin as STO_ProjectOverview_LegendStudioApplicationPlugin_Extension
            ).getExtraTestRunnerTabsEditorRenderers?.() ?? [],
        );
        for (const editorRenderer of extraTestRunnerTabEditorRenderers) {
          const editor = editorRenderer(
            selectedTab,
            editorStore,
            currentWorkspace,
          );
          if (editor) {
            return editor;
          }
        }
        return (
          <UnsupportedEditorPanel
            text="Can't display this editor"
            isReadOnly={true}
          />
        );
      }
    };

    return (
      <Panel>
        <div className="panel__header panel__header--dark">
          <div className="panel__header__tabs">
            {testRunnerTabs.map((tab) => (
              <div
                key={tab.value}
                onClick={() => changeTab(tab.value)}
                className={clsx('panel__header__tab', {
                  ['panel__header__tab--active']: tab.value === selectedTab,
                })}
              >
                {toTitleCase(prettyCONSTName(tab.value))}
              </div>
            ))}
          </div>
        </div>
        <PanelContent>{renderTestRunnerTab()}</PanelContent>
      </Panel>
    );
  },
);
