import React from 'react';
import styled from '@emotion/styled';
import Lozenge from '@atlaskit/lozenge';

export const FormRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;

  & > *:not(:last-child) {
    margin-right: 12px;
  }
`;

export const MinWidthFieldWrapper = styled.div`
  label {
    min-width: 180px;
  }
`;

export function idFind(searchId, array, shouldReturnId = true) {
  return (
    array.find(({ id }) => `${id}` === `${searchId}`) ||
    (shouldReturnId ? { id: searchId } : undefined)
  );
}

export function getDefaultOptionValue(option) {
  return option.id;
}
export function getProjectOptionLabel(option) {
  return `${option.key} - ${option.name}`;
}
export function getComponentOptionLabel(option) {
  return option.name;
}

const IconUrlSpan = styled.span`
  display: inline-flex;
  justify-content: flex-start;
  align-items: center;
`;

const IconUrlImg = styled.img`
  max-width: 16px;
`;

export function getIconUrlOptionLabel(option) {
  return (
    <IconUrlSpan>
      <IconUrlImg src={option.iconUrl} /> {option.name}
    </IconUrlSpan>
  );
}
export function getStatusOptionLabel(option) {
  let appearance = 'default';
  switch (option.statusCategory.colorName) {
    case 'green':
      appearance = 'success';
      break;
    case 'red':
      appearance = 'removed';
      break;
    case 'yellow':
      appearance = 'moved';
      break;
    case 'blue':
      appearance = 'inprogress';
      break;
  }
  return <Lozenge appearance={appearance}>{option.name || ''}</Lozenge>;
}
