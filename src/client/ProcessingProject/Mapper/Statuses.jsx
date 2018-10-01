// @flow
import React, { Component } from 'react';
import Select from '@atlaskit/select/dist/esm/Select';
import { Field, FormSection } from '@atlaskit/form';
import Button from '@atlaskit/button';
import styled from 'styled-components';
import sanitizeData from '../../sanitizeData';

import {
  idFind,
  getDefaultOptionValue,
  getIconUrlOptionLabel,
  getStatusOptionLabel,
  MinWidthFieldWrapper
} from './utils';
import type {
  TransitionMappingStatusType,
  TransitionMappingType
} from '../../../server/transition/types';

type PropsType = {
  jiraData: *,
  data: TransitionMappingType,
  labels: string[],
  update: any
};

type StateType = {
  selectedIssueType?: *
};

const FormRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;

  & > *:not(:last-child) {
    margin-right: 12px;
  }
`;

export default class Statuses extends Component<PropsType> {
  update = (index: number, status: *) => {
    const updated = {
      ...this.props.data,
      statuses: [
        ...this.props.data.statuses.slice(0, index),
        status,
        ...this.props.data.statuses.slice(index + 1)
      ]
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  remove = (index: number) => {
    const updated = {
      ...this.props.data,
      statuses: [
        ...this.props.data.statuses.slice(0, index),
        ...this.props.data.statuses.slice(index + 1)
      ]
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  add = () => {
    const updated = {
      ...this.props.data,
      statuses: [...this.props.data.statuses, {}]
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  render() {
    const { data, jiraData, labels } = this.props;
    return (
      <FormSection name="issue-types">
        <MinWidthFieldWrapper>
          <h3>Map GitLab labels to issue statuses</h3>
          {data.statuses.map((status, index) => (
            <Status
              key={index}
              tags={labels}
              jiraData={jiraData}
              index={index}
              data={status}
              update={this.update}
              remove={this.remove}
            />
          ))}
          <Button appearance="primary" onClick={this.add}>
            Add New Status Mapping
          </Button>
        </MinWidthFieldWrapper>
      </FormSection>
    );
  }
}

type StatusPropsType = {
  index: number,
  tags: string[],
  jiraData: *,
  data: TransitionMappingStatusType,
  update: (index: number, issueMap: *) => void,
  remove: (index: number) => void
};

class Status extends Component<StatusPropsType, StateType> {
  constructor(props: StatusPropsType) {
    super(props);
    this.state = {
      selectedIssueType: idFind(
        props.data.issueTypeId,
        props.jiraData.jiraIssueTypes,
        false
      )
    };
  }

  remove = () => {
    this.props.remove(this.props.index);
  };

  selectIssueType = (option: *) => {
    this.setState({
      selectedIssueType: option
    });
    this.props.update(this.props.index, {
      ...this.props.data,
      issueTypeId: option.id
    });
  };

  selectIssueStatus = (option: *) => {
    this.props.update(this.props.index, {
      ...this.props.data,
      statusId: option.id
    });
  };

  selectTag = ({ value }: *) => {
    this.props.update(this.props.index, {
      ...this.props.data,
      gitlabLabel: value
    });
  };

  render() {
    const { data, tags, jiraData } = this.props;
    const { selectedIssueType } = this.state;
    let selectedIssueTypeStatuses = [];
    if (selectedIssueType) {
      selectedIssueTypeStatuses = selectedIssueType.statuses;
    }
    return (
      <FormRow>
        <Field label="Pick GitLab Tag">
          <Select
            options={tags.map((tag) => ({ value: tag, label: tag }))}
            onChange={this.selectTag}
            defaultValue={{ label: data.gitlabLabel }}
          />
        </Field>
        <Field label="Pick Issue Type">
          <Select
            options={jiraData.jiraIssueTypes}
            getOptionValue={getDefaultOptionValue}
            getOptionLabel={getIconUrlOptionLabel}
            onChange={this.selectIssueType}
            defaultValue={idFind(data.issueTypeId, jiraData.jiraIssueTypes)}
          />
        </Field>
        <Field label="Pick Status">
          <Select
            options={selectedIssueTypeStatuses}
            getOptionValue={getDefaultOptionValue}
            getOptionLabel={getStatusOptionLabel}
            onChange={this.selectIssueStatus}
            defaultValue={idFind(
              data.statusId,
              selectedIssueTypeStatuses,
              false
            )}
          />
        </Field>
        <Button onClick={this.remove}>Delete</Button>
      </FormRow>
    );
  }
}
