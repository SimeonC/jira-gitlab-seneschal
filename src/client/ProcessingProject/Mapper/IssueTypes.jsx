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
  TransitionMappingIssueTypeType,
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

export default class IssueTypes extends Component<PropsType> {
  update = (index: number, issueType: *) => {
    const issueTypes = [...this.props.data.issueTypes];
    issueTypes.splice(index, 1, issueType);
    const updated = {
      ...this.props.data,
      issueTypes
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  remove = (index: number) => {
    const issueTypes = [...this.props.data.issueTypes];
    issueTypes.splice(index, 1);
    const updated = {
      ...this.props.data,
      issueTypes
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  add = () => {
    const issueTypes = [...this.props.data.issueTypes];
    issueTypes.push({});
    const updated = {
      ...this.props.data,
      issueTypes
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
          <h3>Map GitLab labels to issue types</h3>
          {data.issueTypes.map((issueType, index) => (
            <IssueType
              key={index}
              tags={labels}
              jiraData={jiraData}
              index={index}
              data={issueType}
              update={this.update}
              remove={this.remove}
            />
          ))}
          <Button appearance="primary" onClick={this.add}>
            Add New Issue Type Mapping
          </Button>
        </MinWidthFieldWrapper>
      </FormSection>
    );
  }
}

type IssuePropsType = {
  index: number,
  tags: string[],
  jiraData: *,
  data: TransitionMappingIssueTypeType,
  update: (index: number, issueMap: *) => void,
  remove: (index: number) => void
};

class IssueType extends Component<IssuePropsType, StateType> {
  constructor(props: IssuePropsType) {
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

  selectClosedStatus = (option: *) => {
    this.props.update(this.props.index, {
      ...this.props.data,
      closedStatusId: option.id
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
        <Field label="Pick Closed Status">
          <Select
            options={selectedIssueTypeStatuses}
            getOptionValue={getDefaultOptionValue}
            getOptionLabel={getStatusOptionLabel}
            onChange={this.selectClosedStatus}
            defaultValue={idFind(
              data.closedStatusId,
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
