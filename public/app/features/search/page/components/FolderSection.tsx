import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { useAsync, useLocalStorage } from 'react-use';

import { GrafanaTheme2, toIconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Card, Checkbox, CollapsableSection, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { getSectionStorageKey } from 'app/features/search/utils';
import { useUniqueId } from 'app/plugins/datasource/influxdb/components/useUniqueId';

import { SearchItem } from '../..';
import { getGrafanaSearcher, SearchQuery } from '../../service';
import { queryResultToNestedFolderItem } from '../../service/utils';
import { DashboardViewItem } from '../../types';
import { SelectionChecker, SelectionToggle } from '../selection';

interface SectionHeaderProps {
  selection?: SelectionChecker;
  selectionToggle?: SelectionToggle;
  onClickItem?: (e: React.MouseEvent<HTMLElement>) => void;
  onTagSelected: (tag: string) => void;
  section: DashboardViewItem;
  renderStandaloneBody?: boolean; // render the body on its own
  tags?: string[];
}

export const FolderSection = ({
  section,
  selectionToggle,
  onClickItem,
  onTagSelected,
  selection,
  renderStandaloneBody,
  tags,
}: SectionHeaderProps) => {
  const editable = selectionToggle != null;
  const styles = useStyles2(useCallback((theme: GrafanaTheme2) => getSectionHeaderStyles(theme, editable), [editable]));
  const [sectionExpanded, setSectionExpanded] = useLocalStorage(getSectionStorageKey(section.title), false);

  const results = useAsync(async () => {
    if (!sectionExpanded && !renderStandaloneBody) {
      return Promise.resolve([]);
    }
    let query: SearchQuery = {
      query: '*',
      kind: ['dashboard'],
      location: section.uid,
      sort: 'name_sort',
      limit: 1000, // this component does not have infinate scroll, so we need to load everything upfront
    };
    if (section.itemsUIDs) {
      query = {
        uid: section.itemsUIDs, // array of UIDs
      };
    }

    const raw = await getGrafanaSearcher().search({ ...query, tags });
    const items = raw.view.map((v) => queryResultToNestedFolderItem(v, raw.view.dataFrame.meta));
    return items;
  }, [sectionExpanded, tags]);

  const onSectionExpand = () => {
    setSectionExpanded(!sectionExpanded);
  };

  const onToggleFolder = (evt: React.FormEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (selectionToggle && selection) {
      const checked = !selection(section.kind, section.uid);
      selectionToggle(section.kind, section.uid);
      const sub = results.value ?? [];
      for (const item of sub) {
        if (selection('dashboard', item.uid!) !== checked) {
          selectionToggle('dashboard', item.uid!);
        }
      }
    }
  };

  const id = useUniqueId();
  const labelId = `section-header-label-${id}`;

  let icon = toIconName(section.icon ?? '');
  if (!icon) {
    icon = sectionExpanded ? 'folder-open' : 'folder';
  }

  const renderResults = () => {
    if (!results.value) {
      return null;
    } else if (results.value.length === 0 && !results.loading) {
      return (
        <Card>
          <Card.Heading>No results found</Card.Heading>
        </Card>
      );
    }

    return results.value.map((item) => {
      return (
        <SearchItem
          key={item.uid}
          item={item}
          onTagSelected={onTagSelected}
          onToggleChecked={(item) => {
            if (selectionToggle) {
              selectionToggle('dashboard', item.uid!);
            }
          }}
          editable={Boolean(selection != null)}
          onClickItem={onClickItem}
          isSelected={selectionToggle && selection?.(item.kind, item.uid)}
        />
      );
    });
  };

  // Skip the folder wrapper
  if (renderStandaloneBody) {
    return (
      <div className={styles.folderViewResults}>
        {!results.value?.length && results.loading ? <Spinner className={styles.spinner} /> : renderResults()}
      </div>
    );
  }

  return (
    <CollapsableSection
      headerDataTestId={selectors.components.Search.folderHeader(section.title)}
      contentDataTestId={selectors.components.Search.folderContent(section.title)}
      isOpen={sectionExpanded ?? false}
      onToggle={onSectionExpand}
      className={styles.wrapper}
      contentClassName={styles.content}
      loading={results.loading}
      labelId={labelId}
      label={
        <>
          {selectionToggle && selection && (
            <div onClick={onToggleFolder}>
              <Checkbox value={selection(section.kind, section.uid)} aria-label="Select folder" />
            </div>
          )}

          <div className={styles.icon}>
            <Icon name={icon} />
          </div>

          <div className={styles.text}>
            <span id={labelId}>{section.title}</span>
            {section.url && section.uid !== 'general' && (
              <a href={section.url} className={styles.link}>
                <span className={styles.separator}>|</span> <Icon name="folder-upload" /> Go to folder
              </a>
            )}
          </div>
        </>
      }
    >
      {results.value && <ul className={styles.sectionItems}>{renderResults()}</ul>}
    </CollapsableSection>
  );
};

const getSectionHeaderStyles = (theme: GrafanaTheme2, editable: boolean) => {
  const sm = theme.spacing(1);
  return {
    wrapper: css`
      align-items: center;
      font-size: ${theme.typography.size.base};
      padding: 12px;
      border-bottom: none;
      color: ${theme.colors.text.secondary};
      z-index: 1;

      &:hover,
      &.selected {
        color: ${theme.colors.text};
      }

      &:hover,
      &:focus-visible,
      &:focus-within {
        a {
          opacity: 1;
        }
      }
    `,
    sectionItems: css`
      margin: 0 24px 0 32px;
    `,
    icon: css`
      padding: 0 ${sm} 0 ${editable ? 0 : sm};
    `,
    folderViewResults: css`
      overflow: auto;
    `,
    text: css`
      flex-grow: 1;
      line-height: 24px;
    `,
    link: css`
      padding: 2px 10px 0;
      color: ${theme.colors.text.secondary};
      opacity: 0;
      transition: opacity 150ms ease-in-out;
    `,
    separator: css`
      margin-right: 6px;
    `,
    content: css`
      padding-top: 0px;
      padding-bottom: 0px;
    `,
    spinner: css`
      display: grid;
      place-content: center;
      padding-bottom: 1rem;
    `,
  };
};
