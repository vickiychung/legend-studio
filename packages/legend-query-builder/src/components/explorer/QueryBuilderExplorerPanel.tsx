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

import { forwardRef, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  type TreeNodeContainerProps,
  type TreeNodeViewProps,
  type TooltipPlacement,
  type TreeData,
  Tooltip,
  clsx,
  Dialog,
  TreeView,
  BlankPanelContent,
  DropdownMenu,
  ContextMenu,
  MenuContent,
  MenuContentItem,
  MenuContentItemIcon,
  MenuContentItemLabel,
  StringTypeIcon,
  ToggleIcon,
  HashtagIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MoreVerticalIcon,
  CompressIcon,
  EyeIcon,
  InfoCircleIcon,
  PURE_ClassIcon,
  CheckIcon,
  SearchIcon,
  PanelLoadingIndicator,
  DragPreviewLayer,
  useDragPreviewLayer,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalFooterButton,
} from '@finos/legend-art';
import {
  type QueryBuilderExplorerTreeDragSource,
  type QueryBuilderExplorerTreeNodeData,
  QUERY_BUILDER_EXPLORER_TREE_DND_TYPE,
  QueryBuilderExplorerTreeRootNodeData,
  QueryBuilderExplorerTreePropertyNodeData,
  QueryBuilderExplorerTreeSubTypeNodeData,
  getQueryBuilderPropertyNodeData,
  getQueryBuilderSubTypeNodeData,
  buildPropertyExpressionFromExplorerTreeNodeData,
} from '../../stores/explorer/QueryBuilderExplorerState.js';
import { useDrag } from 'react-dnd';
import { QueryBuilderPropertyInfoTooltip } from '../shared/QueryBuilderPropertyInfoTooltip.js';
import type { QueryBuilderState } from '../../stores/QueryBuilderState.js';
import { flowResult } from 'mobx';
import {
  getPropertyChainName,
  prettyPropertyName,
} from '../../stores/QueryBuilderPropertyEditorState.js';
import {
  type Type,
  type Multiplicity,
  type PureModel,
  Class,
  DerivedProperty,
  PrimitiveType,
  PRIMITIVE_TYPE,
  Enumeration,
  TYPE_CAST_TOKEN,
  getAllClassDerivedProperties,
  getMultiplicityDescription,
  getAllClassProperties,
  getAllOwnClassProperties,
  isElementDeprecated,
} from '@finos/legend-graph';
import { useApplicationStore } from '@finos/legend-application';
import { getClassPropertyIcon } from '../shared/ElementIconUtils.js';
import { QUERY_BUILDER_TEST_ID } from '../QueryBuilder_TestID.js';
import { filterByType, guaranteeNonNullable } from '@finos/legend-shared';
import { QueryBuilderPropertySearchPanel } from './QueryBuilderPropertySearchPanel.js';
import { QueryBuilderTDSState } from '../../stores/fetch-structure/tds/QueryBuilderTDSState.js';
import { QueryBuilderSimpleProjectionColumnState } from '../../stores/fetch-structure/tds/projection/QueryBuilderProjectionColumnState.js';

const checkForDeprecatedNode = (
  node: QueryBuilderExplorerTreeNodeData,
  graph: PureModel,
  treeData: TreeData<QueryBuilderExplorerTreeNodeData>,
): boolean => {
  if (node.type instanceof Class && isElementDeprecated(node.type, graph)) {
    return true;
  }
  if (node instanceof QueryBuilderExplorerTreePropertyNodeData) {
    if (isElementDeprecated(node.property, graph)) {
      return true;
    }
  }
  if (node instanceof QueryBuilderExplorerTreeSubTypeNodeData) {
    const parentNode = treeData.nodes.get(node.parentId);
    if (
      parentNode?.type instanceof Class &&
      isElementDeprecated(parentNode.type, graph)
    ) {
      return true;
    }
  }
  return false;
};

export const isExplorerTreeNodeAlreadyUsed = (
  node: QueryBuilderExplorerTreeNodeData,
  queryBuilderState: QueryBuilderState,
): boolean => {
  // if the fetch-structure is non-empty, it means we can mark the root node as used
  if (
    node instanceof QueryBuilderExplorerTreeRootNodeData &&
    queryBuilderState.fetchStructureState.implementation
      .usedExplorerTreePropertyNodeIDs.length > 0
  ) {
    return true;
  }
  // in the explorer tree, we represent subtype as a subtree, we want to flatten this to only
  // the subtype that actually being used to make comparison simpler
  const simplifiedNodeID = node.id.replaceAll(/(?:@[^.]+)+/g, (val) => {
    const chunks = val.split(TYPE_CAST_TOKEN);
    return `${TYPE_CAST_TOKEN}${chunks[chunks.length - 1]}`;
  });
  return queryBuilderState.fetchStructureState.implementation.usedExplorerTreePropertyNodeIDs.includes(
    simplifiedNodeID,
  );
};

export const QueryBuilderSubclassInfoTooltip: React.FC<{
  subclass: Class;
  path: string;
  isMapped: boolean;
  children: React.ReactElement;
  placement?: TooltipPlacement | undefined;
  multiplicity: Multiplicity;
}> = (props) => {
  const { subclass, path, isMapped, children, placement, multiplicity } = props;
  return (
    <Tooltip
      arrow={true}
      {...(placement !== undefined ? { placement } : {})}
      classes={{
        tooltip: 'query-builder__tooltip',
        arrow: 'query-builder__tooltip__arrow',
        tooltipPlacementRight: 'query-builder__tooltip--right',
      }}
      TransitionProps={{
        // disable transition
        // NOTE: somehow, this is the only workaround we have, if for example
        // we set `appear = true`, the tooltip will jump out of position
        timeout: 0,
      }}
      title={
        <div className="query-builder__tooltip__content">
          <div className="query-builder__tooltip__item">
            <div className="query-builder__tooltip__item__label">Type</div>
            <div className="query-builder__tooltip__item__value">
              {subclass.path}
            </div>
          </div>
          <div className="query-builder__tooltip__item">
            <div className="query-builder__tooltip__item__label">Path</div>
            <div className="query-builder__tooltip__item__value">{path}</div>
          </div>
          <div className="query-builder__tooltip__item">
            <div className="query-builder__tooltip__item__label">
              Multiplicity
            </div>
            <div className="query-builder__tooltip__item__value">
              {getMultiplicityDescription(multiplicity)}
            </div>
          </div>
          <div className="query-builder__tooltip__item">
            <div className="query-builder__tooltip__item__label">Mapped</div>
            <div className="query-builder__tooltip__item__value">
              {isMapped ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      }
    >
      {children}
    </Tooltip>
  );
};

const QueryBuilderExplorerPreviewDataModal = observer(
  (props: { queryBuilderState: QueryBuilderState }) => {
    const { queryBuilderState } = props;
    const previewDataState = queryBuilderState.explorerState.previewDataState;
    const close = (): void => previewDataState.setPreviewData(undefined);

    return (
      <Dialog
        open={
          Boolean(previewDataState.previewData) ||
          previewDataState.isGeneratingPreviewData
        }
        onClose={close}
        classes={{
          root: 'editor-modal__root-container',
          container: 'editor-modal__container',
          paper: 'editor-modal__content',
        }}
      >
        <Modal
          darkMode={true}
          className="editor-modal query-builder__explorer__preview-data-modal"
        >
          <ModalHeader
            title={prettyPropertyName(previewDataState.propertyName)}
          />
          <PanelLoadingIndicator
            isLoading={previewDataState.isGeneratingPreviewData}
          />
          <ModalBody className="query-builder__explorer__preview-data-modal__body">
            {previewDataState.isGeneratingPreviewData && (
              <div className="query-builder__explorer__preview-data-modal__placeholder">
                Loading preview data...
              </div>
            )}
            {previewDataState.previewData && (
              <table className="table">
                <thead>
                  <tr>
                    {previewDataState.previewData.columns.map((column, idx) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <th key={idx} className="table__cell--left">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewDataState.previewData.rows.map((row, rowIdx) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={rowIdx}>
                      {row.values.map((value, idx) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <td key={idx} className="table__cell--left">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ModalBody>
          <ModalFooter>
            <ModalFooterButton text="Close" onClick={close} />
          </ModalFooter>
        </Modal>
      </Dialog>
    );
  },
);

const QueryBuilderExplorerContextMenu = observer(
  forwardRef<
    HTMLDivElement,
    {
      queryBuilderState: QueryBuilderState;
      openNode: () => void;
      node: QueryBuilderExplorerTreeNodeData;
    }
  >(function QueryBuilderExplorerContextMenu(props, ref) {
    const { queryBuilderState, openNode, node } = props;
    const addNodeToFetchStructure = (): void =>
      queryBuilderState.fetchStructureState.fetchProperty(node);
    const addNodeChildrenToFetchStructure = (): void => {
      openNode();
      if (node.type instanceof Class) {
        // NOTE: here we require the node to already been expanded so the child nodes are generated
        // we don't allow adding unopened node. Maybe if it helps, we can show a warning.
        const nodesToAdd = node.childrenIds
          .map((childId) =>
            queryBuilderState.explorerState.nonNullableTreeData.nodes.get(
              childId,
            ),
          )
          .filter(filterByType(QueryBuilderExplorerTreePropertyNodeData))
          .filter(
            (childNode) =>
              !(childNode.type instanceof Class) &&
              childNode.mappingData.mapped,
          )
          .filter((childNode) => {
            const propertyExpression =
              buildPropertyExpressionFromExplorerTreeNodeData(
                childNode,
                queryBuilderState.explorerState,
              );
            if (
              queryBuilderState.fetchStructureState.implementation instanceof
              QueryBuilderTDSState
            ) {
              const currentProjectColumns =
                queryBuilderState.fetchStructureState.implementation.projectionColumns.find(
                  (currCol) => {
                    if (
                      currCol instanceof QueryBuilderSimpleProjectionColumnState
                    ) {
                      return (
                        currCol.propertyExpressionState.path === childNode.id &&
                        currCol.columnName ===
                          getPropertyChainName(propertyExpression, true)
                      );
                    }
                    return undefined;
                  },
                );
              return currentProjectColumns === undefined;
            }
            return true;
          });
        nodesToAdd.forEach((nodeToAdd) =>
          queryBuilderState.fetchStructureState.fetchProperty(nodeToAdd),
        );
      }
    };

    return (
      <MenuContent ref={ref}>
        {node instanceof QueryBuilderExplorerTreePropertyNodeData &&
          !(node.type instanceof Class) && (
            <MenuContentItem onClick={addNodeToFetchStructure}>
              Add Property to Fetch Structure
            </MenuContentItem>
          )}
        {node.type instanceof Class && (
          <MenuContentItem onClick={addNodeChildrenToFetchStructure}>
            Add Properties to Fetch Structure
          </MenuContentItem>
        )}
      </MenuContent>
    );
  }),
);

export const renderPropertyTypeIcon = (type: Type): React.ReactNode => {
  if (type instanceof PrimitiveType) {
    if (type.name === PRIMITIVE_TYPE.STRING) {
      return (
        <StringTypeIcon className="query-builder-explorer-tree__icon query-builder-explorer-tree__icon__string" />
      );
    } else if (type.name === PRIMITIVE_TYPE.BOOLEAN) {
      return (
        <ToggleIcon className="query-builder-explorer-tree__icon query-builder-explorer-tree__icon__boolean" />
      );
    } else if (
      type.name === PRIMITIVE_TYPE.NUMBER ||
      type.name === PRIMITIVE_TYPE.INTEGER ||
      type.name === PRIMITIVE_TYPE.FLOAT ||
      type.name === PRIMITIVE_TYPE.DECIMAL
    ) {
      return (
        <HashtagIcon className="query-builder-explorer-tree__icon query-builder-explorer-tree__icon__number" />
      );
    } else if (
      type.name === PRIMITIVE_TYPE.DATE ||
      type.name === PRIMITIVE_TYPE.DATETIME ||
      type.name === PRIMITIVE_TYPE.STRICTDATE
    ) {
      return (
        <ClockIcon className="query-builder-explorer-tree__icon query-builder-explorer-tree__icon__time" />
      );
    }
  }
  return getClassPropertyIcon(type);
};

const QueryBuilderExplorerTreeNodeContainer = observer(
  (
    props: TreeNodeContainerProps<
      QueryBuilderExplorerTreeNodeData,
      {
        queryBuilderState: QueryBuilderState;
      }
    >,
  ) => {
    const { node, level, stepPaddingInRem, onNodeSelect, innerProps } = props;
    const { queryBuilderState } = innerProps;
    const [isSelectedFromContextMenu, setIsSelectedFromContextMenu] =
      useState(false);
    const applicationStore = useApplicationStore();
    const explorerState = queryBuilderState.explorerState;
    const [, dragConnector, dragPreviewConnector] = useDrag<{
      node?: QueryBuilderExplorerTreePropertyNodeData;
    }>(
      () => ({
        type:
          node instanceof QueryBuilderExplorerTreePropertyNodeData
            ? node.type instanceof Enumeration
              ? QUERY_BUILDER_EXPLORER_TREE_DND_TYPE.ENUM_PROPERTY
              : node.type instanceof Class
              ? QUERY_BUILDER_EXPLORER_TREE_DND_TYPE.CLASS_PROPERTY
              : QUERY_BUILDER_EXPLORER_TREE_DND_TYPE.PRIMITIVE_PROPERTY
            : QUERY_BUILDER_EXPLORER_TREE_DND_TYPE.ROOT,
        item: () =>
          node instanceof QueryBuilderExplorerTreePropertyNodeData
            ? { node }
            : {},
      }),
      [node],
    );
    useDragPreviewLayer(dragPreviewConnector);

    const isExpandable = Boolean(node.childrenIds.length);
    const isDerivedProperty =
      node instanceof QueryBuilderExplorerTreePropertyNodeData &&
      node.property instanceof DerivedProperty;
    const isMultiple =
      (node instanceof QueryBuilderExplorerTreePropertyNodeData &&
        (node.property.multiplicity.upperBound === undefined ||
          node.property.multiplicity.upperBound > 1)) ||
      (node instanceof QueryBuilderExplorerTreeSubTypeNodeData &&
        (node.multiplicity.upperBound === undefined ||
          node.multiplicity.upperBound > 1));
    const allowPreview =
      node.mappingData.mapped &&
      node instanceof QueryBuilderExplorerTreePropertyNodeData &&
      node.type instanceof PrimitiveType &&
      !node.isPartOfDerivedPropertyBranch;
    const nodeExpandIcon = isExpandable ? (
      node.isOpen ? (
        <ChevronDownIcon />
      ) : (
        <ChevronRightIcon />
      )
    ) : (
      <div />
    );
    const selectNode = (): void => onNodeSelect?.(node);
    const openNode = (): void => {
      if (!node.isOpen) {
        onNodeSelect?.(node);
      }
    };
    // context menu
    const onContextMenuOpen = (): void => setIsSelectedFromContextMenu(true);
    const onContextMenuClose = (): void => setIsSelectedFromContextMenu(false);
    const previewData = (): void => {
      if (node instanceof QueryBuilderExplorerTreePropertyNodeData) {
        flowResult(explorerState.previewData(node)).catch(
          applicationStore.alertUnhandledError,
        );
      }
    };

    if (
      !node.mappingData.mapped &&
      // NOTE: we always want to show at least the root node
      !(node instanceof QueryBuilderExplorerTreeRootNodeData) &&
      !explorerState.showUnmappedProperties
    ) {
      return null;
    }
    return (
      <ContextMenu
        content={
          <QueryBuilderExplorerContextMenu
            queryBuilderState={queryBuilderState}
            openNode={openNode}
            node={node}
          />
        }
        disabled={
          !(
            node instanceof QueryBuilderExplorerTreePropertyNodeData ||
            node instanceof QueryBuilderExplorerTreeRootNodeData
          ) || applicationStore.showBackdrop
        }
        menuProps={{ elevation: 7 }}
        onOpen={onContextMenuOpen}
        onClose={onContextMenuClose}
      >
        <div
          className={clsx(
            'tree-view__node__container query-builder-explorer-tree__node__container',
            {
              'query-builder-explorer-tree__node__container--selected-from-context-menu':
                isSelectedFromContextMenu,
              'query-builder-explorer-tree__node__container--unmapped':
                !node.mappingData.mapped,
              'query-builder-explorer-tree__node__container--selected':
                node.isSelected,

              'query-builder-explorer-tree__node__container--highlighted':
                explorerState.highlightUsedProperties &&
                isExplorerTreeNodeAlreadyUsed(node, queryBuilderState),
            },
          )}
          title={
            !node.mappingData.mapped
              ? node instanceof QueryBuilderExplorerTreeRootNodeData
                ? 'Root class is not mapped'
                : 'Property is not mapped'
              : undefined
          }
          onClick={selectNode}
          ref={
            node.mappingData.mapped && !isExpandable ? dragConnector : undefined
          }
          style={{
            paddingLeft: `${(level - 1) * (stepPaddingInRem ?? 1) + 0.5}rem`,
            display: 'flex',
          }}
        >
          {node instanceof QueryBuilderExplorerTreeRootNodeData && (
            <>
              <div className="tree-view__node__icon query-builder-explorer-tree__node__icon">
                <div className="query-builder-explorer-tree__expand-icon">
                  {nodeExpandIcon}
                </div>
                <div className="query-builder-explorer-tree__type-icon">
                  <PURE_ClassIcon />
                </div>
              </div>
              <div className="tree-view__node__label query-builder-explorer-tree__node__label">
                {node.label}
              </div>
            </>
          )}
          {(node instanceof QueryBuilderExplorerTreePropertyNodeData ||
            node instanceof QueryBuilderExplorerTreeSubTypeNodeData) && (
            <>
              <div className="tree-view__node__icon query-builder-explorer-tree__node__icon">
                <div className="query-builder-explorer-tree__expand-icon">
                  {nodeExpandIcon}
                </div>
                <div className="query-builder-explorer-tree__type-icon">
                  {renderPropertyTypeIcon(node.type)}
                </div>
              </div>
              <div
                className={clsx(
                  'tree-view__node__label query-builder-explorer-tree__node__label query-builder-explorer-tree__node__label--with-action',
                  {
                    'query-builder-explorer-tree__node__label--with-preview':
                      allowPreview,
                  },
                )}
              >
                <div
                  className={clsx(
                    'query-builder-explorer-tree__node__label--property__name',
                    {
                      'query-builder-explorer-tree__node__label--deprecated':
                        checkForDeprecatedNode(
                          node,
                          explorerState.queryBuilderState.graphManagerState
                            .graph,
                          explorerState.nonNullableTreeData,
                        ),
                    },
                  )}
                >
                  {explorerState.humanizePropertyName
                    ? node instanceof QueryBuilderExplorerTreeSubTypeNodeData
                      ? TYPE_CAST_TOKEN + prettyPropertyName(node.label)
                      : prettyPropertyName(node.label)
                    : node instanceof QueryBuilderExplorerTreeSubTypeNodeData
                    ? TYPE_CAST_TOKEN + node.label
                    : node.label}
                </div>
                {isDerivedProperty && (
                  <div
                    className="query-builder-explorer-tree__node__label__derived-property"
                    title="Property is derived and may require user to specify parameter values"
                  >
                    (...)
                  </div>
                )}
                {isMultiple && (
                  <div
                    className="query-builder-explorer-tree__node__label__multiple"
                    title="Multiple values of this property can cause row explosion"
                  >
                    *
                  </div>
                )}
              </div>
              <div className="query-builder-explorer-tree__node__actions">
                {allowPreview && (
                  <button
                    className="query-builder-explorer-tree__node__action"
                    disabled={
                      explorerState.previewDataState.isGeneratingPreviewData
                    }
                    tabIndex={-1}
                    title="Preview Data"
                    onClick={previewData}
                  >
                    <EyeIcon />
                  </button>
                )}
                {node instanceof QueryBuilderExplorerTreePropertyNodeData && (
                  <QueryBuilderPropertyInfoTooltip
                    property={node.property}
                    path={node.id}
                    isMapped={node.mappingData.mapped}
                  >
                    <div className="query-builder-explorer-tree__node__action query-builder-explorer-tree__node__info">
                      <InfoCircleIcon />
                    </div>
                  </QueryBuilderPropertyInfoTooltip>
                )}
                {node instanceof QueryBuilderExplorerTreeSubTypeNodeData && (
                  <QueryBuilderSubclassInfoTooltip
                    subclass={node.subclass}
                    path={node.id}
                    isMapped={node.mappingData.mapped}
                    multiplicity={node.multiplicity}
                  >
                    <div className="query-builder-explorer-tree__node__action query-builder-explorer-tree__node__info">
                      <InfoCircleIcon />
                    </div>
                  </QueryBuilderSubclassInfoTooltip>
                )}
              </div>
            </>
          )}
        </div>
      </ContextMenu>
    );
  },
);

const QueryBuilderExplorerTreeNodeView = observer(
  (
    props: TreeNodeViewProps<
      QueryBuilderExplorerTreeNodeData,
      {
        queryBuilderState: QueryBuilderState;
      }
    >,
  ) => {
    const {
      node,
      level,
      onNodeSelect,
      getChildNodes,
      stepPaddingInRem,
      innerProps,
    } = props;
    const { queryBuilderState } = innerProps;

    if (
      !node.mappingData.mapped &&
      // NOTE: we always want to show at least the root node
      !(node instanceof QueryBuilderExplorerTreeRootNodeData) &&
      !queryBuilderState.explorerState.showUnmappedProperties
    ) {
      return null;
    }
    return (
      <div className="tree-view__node__block">
        <QueryBuilderExplorerTreeNodeContainer
          node={node}
          level={level + 1}
          stepPaddingInRem={stepPaddingInRem}
          onNodeSelect={onNodeSelect}
          innerProps={innerProps}
        />
        {node.isOpen &&
          getChildNodes(node).map((childNode) => (
            <QueryBuilderExplorerTreeNodeView
              key={childNode.id}
              node={childNode}
              level={level + 1}
              onNodeSelect={onNodeSelect}
              getChildNodes={getChildNodes}
              innerProps={innerProps}
            />
          ))}
      </div>
    );
  },
);

/**
 * Sort order for Query Builder tree nodes will be ranked by return type as followed:
 * 1. Primitive
 * 2. Enumeration
 * 3. Class
 * 4. Class Subtypes
 * Note: Derived property nodes will be ranked lower for each relevant return type
 */
const getQueryBuilderExplorerTreeNodeSortRank = (
  node: QueryBuilderExplorerTreeNodeData,
): number => {
  if (node instanceof QueryBuilderExplorerTreeSubTypeNodeData) {
    return 0;
  } else if (node.type instanceof Class) {
    return node.isPartOfDerivedPropertyBranch ? 1 : 2;
  } else if (node.type instanceof Enumeration) {
    return node.isPartOfDerivedPropertyBranch ? 3 : 4;
  } else {
    return node.isPartOfDerivedPropertyBranch ? 5 : 6;
  }
};

const QueryBuilderExplorerTree = observer(
  (props: { queryBuilderState: QueryBuilderState }) => {
    const { queryBuilderState } = props;
    const explorerState = queryBuilderState.explorerState;
    const treeData = explorerState.nonNullableTreeData;
    const onNodeSelect = (node: QueryBuilderExplorerTreeNodeData): void => {
      if (node.childrenIds.length) {
        node.isOpen = !node.isOpen;
        if (
          node.isOpen &&
          (node instanceof QueryBuilderExplorerTreePropertyNodeData ||
            node instanceof QueryBuilderExplorerTreeSubTypeNodeData) &&
          node.type instanceof Class
        ) {
          (node instanceof QueryBuilderExplorerTreeSubTypeNodeData
            ? getAllOwnClassProperties(node.type)
            : getAllClassProperties(node.type).concat(
                getAllClassDerivedProperties(node.type),
              )
          ).forEach((property) => {
            const propertyTreeNodeData = getQueryBuilderPropertyNodeData(
              property,
              node,
              guaranteeNonNullable(
                explorerState.mappingModelCoverageAnalysisResult,
              ),
            );
            if (propertyTreeNodeData) {
              treeData.nodes.set(propertyTreeNodeData.id, propertyTreeNodeData);
            }
          });
          node.type._subclasses.forEach((subclass) => {
            const subTypeTreeNodeData = getQueryBuilderSubTypeNodeData(
              subclass,
              node,
              guaranteeNonNullable(
                explorerState.mappingModelCoverageAnalysisResult,
              ),
            );
            treeData.nodes.set(subTypeTreeNodeData.id, subTypeTreeNodeData);
          });
        }
      }
      explorerState.refreshTree();
    };
    const getChildNodes = (
      node: QueryBuilderExplorerTreeNodeData,
    ): QueryBuilderExplorerTreeNodeData[] =>
      node.childrenIds
        .map((id) => treeData.nodes.get(id))
        .filter(
          (
            childNode,
          ): childNode is
            | QueryBuilderExplorerTreePropertyNodeData
            | QueryBuilderExplorerTreeSubTypeNodeData =>
            childNode instanceof QueryBuilderExplorerTreeSubTypeNodeData ||
            childNode instanceof QueryBuilderExplorerTreePropertyNodeData,
        )
        // simple properties come first
        .sort((a, b) => a.label.localeCompare(b.label))
        .sort(
          (a, b) =>
            getQueryBuilderExplorerTreeNodeSortRank(b) -
            getQueryBuilderExplorerTreeNodeSortRank(a),
        );

    return (
      <TreeView
        components={{
          TreeNodeContainer: QueryBuilderExplorerTreeNodeContainer,
          TreeNodeView: QueryBuilderExplorerTreeNodeView,
        }}
        className="query-builder-explorer-tree__root"
        treeData={treeData}
        onNodeSelect={onNodeSelect}
        getChildNodes={getChildNodes}
        innerProps={{
          queryBuilderState,
        }}
      />
    );
  },
);

export const QueryBuilderExplorerPanel = observer(
  (props: { queryBuilderState: QueryBuilderState }) => {
    const { queryBuilderState } = props;
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    const explorerState = queryBuilderState.explorerState;
    const propertySearchPanelState = explorerState.propertySearchState;
    const applicationStore = useApplicationStore();
    const collapseTree = (): void => {
      if (explorerState.treeData) {
        Array.from(explorerState.treeData.nodes.values()).forEach((node) => {
          node.isOpen = false;
        });
        explorerState.refreshTree();
      }
    };
    const toggleShowUnmappedProperties = (): void =>
      explorerState.setShowUnmappedProperties(
        !explorerState.showUnmappedProperties,
      );
    const toggleHumanizePropertyName = (): void =>
      explorerState.setHumanizePropertyName(
        !explorerState.humanizePropertyName,
      );
    const toggleHighlightUsedProperties = (): void =>
      explorerState.setHighlightUsedProperties(
        !explorerState.highlightUsedProperties,
      );
    const togglePropertySearch = (): void => {
      if (explorerState.treeData) {
        if (!propertySearchPanelState.isSearchPanelOpen) {
          propertySearchPanelState.setIsSearchPanelOpen(true);
          propertySearchPanelState.initialize();
        } else {
          propertySearchPanelState.setIsSearchPanelOpen(false);
        }
      }
    };

    useEffect(() => {
      flowResult(explorerState.analyzeMappingModelCoverage()).catch(
        applicationStore.alertUnhandledError,
      );
    }, [applicationStore, explorerState, queryBuilderState.mapping]);
    return (
      <div
        data-testid={QUERY_BUILDER_TEST_ID.QUERY_BUILDER_EXPLORER}
        className={clsx('panel query-builder__explorer', {
          backdrop__element: applicationStore.showBackdrop,
        })}
      >
        <div className="panel__header">
          <div className="panel__header__title">
            <div className="panel__header__title__label">explorer</div>
          </div>
          <div className="panel__header__actions">
            <button
              ref={searchButtonRef}
              className={clsx('panel__header__action', {
                'query-builder__explorer__header__action--active':
                  propertySearchPanelState.isSearchPanelOpen,
              })}
              onClick={togglePropertySearch}
              tabIndex={-1}
              title="Toggle property search"
            >
              <SearchIcon />
            </button>
            <button
              className="panel__header__action"
              onClick={collapseTree}
              tabIndex={-1}
              title="Collapse Tree"
            >
              <CompressIcon />
            </button>
            <DropdownMenu
              className="panel__header__action"
              title="Show Options Menu..."
              content={
                <MenuContent>
                  <MenuContentItem onClick={toggleShowUnmappedProperties}>
                    <MenuContentItemIcon>
                      {explorerState.showUnmappedProperties ? (
                        <CheckIcon />
                      ) : null}
                    </MenuContentItemIcon>
                    <MenuContentItemLabel>
                      Show Unmapped Properties
                    </MenuContentItemLabel>
                  </MenuContentItem>
                  <MenuContentItem onClick={toggleHumanizePropertyName}>
                    <MenuContentItemIcon>
                      {explorerState.humanizePropertyName ? (
                        <CheckIcon />
                      ) : null}
                    </MenuContentItemIcon>
                    <MenuContentItemLabel>
                      Humanize Property Name
                    </MenuContentItemLabel>
                  </MenuContentItem>
                  <MenuContentItem onClick={toggleHighlightUsedProperties}>
                    <MenuContentItemIcon>
                      {explorerState.highlightUsedProperties ? (
                        <CheckIcon />
                      ) : null}
                    </MenuContentItemIcon>
                    <MenuContentItemLabel>
                      Highlight already used properties
                    </MenuContentItemLabel>
                  </MenuContentItem>
                </MenuContent>
              }
              menuProps={{
                anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                transformOrigin: { vertical: 'top', horizontal: 'left' },
                elevation: 7,
              }}
            >
              <MoreVerticalIcon className="query-builder__icon__more-options" />
            </DropdownMenu>
          </div>
          {propertySearchPanelState.isSearchPanelOpen && (
            <QueryBuilderPropertySearchPanel
              queryBuilderState={queryBuilderState}
              triggerElement={searchButtonRef.current}
            />
          )}
        </div>
        <div className="panel__content query-builder-explorer-tree__content">
          <PanelLoadingIndicator
            isLoading={
              explorerState.mappingModelCoverageAnalysisState.isInProgress
            }
          />
          <DragPreviewLayer
            labelGetter={(item: QueryBuilderExplorerTreeDragSource): string =>
              explorerState.humanizePropertyName
                ? prettyPropertyName(item.node.label)
                : item.node.label
            }
            types={Object.values(QUERY_BUILDER_EXPLORER_TREE_DND_TYPE)}
          />
          {explorerState.mappingModelCoverageAnalysisState.isInProgress ? (
            <BlankPanelContent>
              {explorerState.mappingModelCoverageAnalysisState.message}
            </BlankPanelContent>
          ) : (
            <>
              {!explorerState.treeData && (
                <BlankPanelContent>
                  Specify the class, mapping, and runtime to start building
                  query
                </BlankPanelContent>
              )}
              {explorerState.treeData && (
                <QueryBuilderExplorerTree
                  queryBuilderState={queryBuilderState}
                />
              )}
            </>
          )}
          <QueryBuilderExplorerPreviewDataModal
            queryBuilderState={queryBuilderState}
          />
        </div>
      </div>
    );
  },
);
