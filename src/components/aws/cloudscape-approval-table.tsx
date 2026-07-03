import { ReactNode, useMemo } from "react";
import Table from "@cloudscape-design/components/table";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import TextFilter from "@cloudscape-design/components/text-filter";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Input from "@cloudscape-design/components/input";
import { useCollection } from "@cloudscape-design/collection-hooks";

export type CloudscapeColumn<T> = {
  id: string;
  header: string;
  cell: (item: T) => ReactNode;
  align?: "right";
  minWidth?: number;
  sortingField?: keyof T | string;
};

export interface CloudscapeApprovalTableProps<T> {
  title: string;
  countLabel?: string;
  rows: T[];
  columns: CloudscapeColumn<T>[];
  rowKey: (r: T, index: number) => string;
  loading?: boolean;
  showSelect?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  onAccept?: () => void;
  onReject?: () => void;
  acceptDisabled?: boolean;
  rejectDisabled?: boolean;
  acceptLoading?: boolean;
  rejectLoading?: boolean;
  // Optional editable reason column (pending only)
  showReason?: boolean;
  reasonValue?: (k: string) => string;
  onReasonChange?: (k: string, value: string) => void;
  reasonInvalid?: (k: string) => boolean;
  // Optional "read only reason" for accepted/rejected
  readonlyReason?: (r: T) => string | null;
  emptyMessage?: ReactNode;
  pageSize?: number;
  headerExtras?: ReactNode;
}

export function CloudscapeApprovalTable<T>({
  title,
  countLabel,
  rows,
  columns,
  rowKey,
  loading,
  showSelect,
  selectedKeys,
  onSelectionChange,
  onAccept,
  onReject,
  acceptDisabled,
  rejectDisabled,
  acceptLoading,
  rejectLoading,
  showReason,
  reasonValue,
  onReasonChange,
  reasonInvalid,
  readonlyReason,
  emptyMessage,
  pageSize = 25,
  headerExtras,
}: CloudscapeApprovalTableProps<T>) {
  const items = useMemo(
    () => rows.map((r, i) => ({ ...(r as any), __key: rowKey(r, i) }) as T & { __key: string }),
    [rows, rowKey],
  );

  const {
    items: pagedItems,
    filterProps,
    filteredItemsCount,
    paginationProps,
    collectionProps,
  } = useCollection(items, {
    filtering: {
      empty: emptyMessage ?? "No records.",
      noMatch: "No records match the filter.",
    },
    pagination: { pageSize },
    sorting: {},
    selection: {},
  });

  const selectedItems = useMemo(
    () => (selectedKeys ? items.filter((it) => selectedKeys.has(it.__key)) : []),
    [items, selectedKeys],
  );

  const columnDefinitions = useMemo(() => {
    const cols = columns.map((c) => ({
      id: c.id,
      header: c.header,
      cell: (item: T) => c.cell(item),
      minWidth: c.minWidth ?? 120,
      sortingField: c.sortingField as string | undefined,
    }));
    if (showReason) {
      cols.push({
        id: "__reason",
        header: "Reason",
        cell: (item: any) => {
          const k = item.__key as string;
          if (readonlyReason && !showSelect) return readonlyReason(item) ?? "—";
          const val = reasonValue?.(k) ?? "";
          const invalid = reasonInvalid?.(k) ?? false;
          return (
            <div style={{ width: 180 }}>
              <Input
                value={val}
                onChange={({ detail }) => onReasonChange?.(k, detail.value)}
                placeholder="Required"
                invalid={invalid}
              />
            </div>
          );
        },
        minWidth: 200,
        sortingField: undefined,
      });
    } else if (readonlyReason) {
      cols.push({
        id: "__reason",
        header: "Reason",
        cell: (item: T) => readonlyReason(item) ?? "—",
        minWidth: 160,
        sortingField: undefined,
      });
    }
    return cols;
  }, [columns, showReason, showSelect, reasonValue, reasonInvalid, onReasonChange, readonlyReason]);

  return (
    <div className="awsui-app-scope">
      <Table
        {...collectionProps}
        variant="container"
        stickyHeader
        stripedRows
        resizableColumns
        loading={loading}
        loadingText="Fetching from SAP…"
        items={pagedItems}
        columnDefinitions={columnDefinitions as any}
        selectionType={showSelect ? "multi" : undefined}
        selectedItems={selectedItems as any}
        onSelectionChange={({ detail }) => {
          if (!onSelectionChange) return;
          const next = new Set<string>();
          detail.selectedItems.forEach((it: any) => next.add(it.__key));
          onSelectionChange(next);
        }}
        trackBy="__key"
        header={
          <Header
            counter={countLabel}
            actions={
              showSelect && (onAccept || onReject) ? (
                <SpaceBetween direction="horizontal" size="xs">
                  {headerExtras}
                  <Button
                    variant="normal"
                    disabled={rejectDisabled}
                    loading={rejectLoading}
                    onClick={onReject}
                    iconName="close"
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    disabled={acceptDisabled}
                    loading={acceptLoading}
                    onClick={onAccept}
                    iconName="check"
                  >
                    Accept
                  </Button>
                </SpaceBetween>
              ) : (
                headerExtras
              )
            }
          >
            {title}
          </Header>
        }
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder="Find records"
            countText={
              filteredItemsCount !== undefined
                ? `${filteredItemsCount} match${filteredItemsCount === 1 ? "" : "es"}`
                : ""
            }
          />
        }
        pagination={<Pagination {...paginationProps} />}
        empty={emptyMessage ?? "No records."}
      />
    </div>
  );
}
