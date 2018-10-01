import React from 'react';
import styled from 'styled-components';
import { Status } from '@atlaskit/status';

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
  return (
    <Status text={option.name || ''} color={option.statusCategory.colorName} />
  );
}
