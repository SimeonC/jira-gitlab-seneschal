import React, { Fragment } from 'react';
import Lozenge from '@atlaskit/lozenge';

export function buildMeta(map, name, statuses) {
  const result = { ...map };
  result.__meta = map.__meta || {};
  result.__meta.name = name;
  ['open', 'close', 'merge'].forEach((statusKey) => {
    result.__meta[`${statusKey}Statuses`] = [];
    const idKey = `${statusKey}StatusIds`;
    if (result[idKey]) {
      result[idKey].forEach((statusId) => {
        const status = statuses.find(({ id }) => statusId === id);
        if (status) {
          result.__meta[`${statusKey}Statuses`].push({
            name: status.name,
            color: status.statusCategory.colorName
          });
        }
      });
    }
  });
  return result;
}

export const Status = ({ text, color = 'neutral' }) => {
  const appearanceMap = {
    neutral: 'default',
    purple: 'new',
    blue: 'inprogress',
    red: 'removed',
    yellow: 'moved',
    green: 'success'
  };
  return <Lozenge appearance={appearanceMap[color]}>{text}</Lozenge>;
};

export const statusSelectOptions = {
  isMulti: true,
  getOptionValue: (option) => option.id,
  getOptionLabel: (option) => option.name,
  formatOptionLabel: ({ name, statusCategory = {} }) => (
    <Status text={name || ''} color={statusCategory.colorName} />
  ),
  formatGroupLabel: ({ name, iconUrl, issueTypes }) => (
    <span>
      {(issueTypes || [{ name, iconUrl }]).map(({ name, iconUrl }, index) => (
        <span key={name} style={{ wordBreak: 'none', display: 'inline-flex' }}>
          {iconUrl ? <img src={iconUrl} style={{ marginRight: 6 }} /> : null}
          {name}
          {issueTypes && index < issueTypes.length - 1 ? (
            <Fragment>,&nbsp;</Fragment>
          ) : (
            ''
          )}
        </span>
      ))}
    </span>
  )
};
