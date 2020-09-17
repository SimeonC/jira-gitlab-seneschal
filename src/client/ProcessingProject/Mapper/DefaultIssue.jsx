// @flow
import React, { Component } from 'react';
import Select from '@atlaskit/select/dist/esm/Select';
import { Field, FormSection } from '@atlaskit/form';
import sanitizeData from '../../sanitizeData';

import {
  idFind,
  getDefaultOptionValue,
  getIconUrlOptionLabel,
  getStatusOptionLabel,
  MinWidthFieldWrapper
} from './utils';

type PropsType = {
  jiraData: *,
  data: *,
  update: *
};

type StateType = {
  selectedIssueType?: *
};

export default class DefaultIssue extends Component<PropsType, StateType> {
  constructor(props: PropsType) {
    super(props);

    this.state = {
      selectedIssueType: idFind(
        props.data.defaultIssueTypeId,
        props.jiraData.jiraIssueTypes,
        false
      )
    };
  }

  selectDefaultIssueType = (option: *) => {
    const updated = {
      ...this.props.data,
      defaultIssueTypeId: option.id
    };
    this.setState({
      selectedIssueType: option
    });
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  selectClosedStatus = (option: *) => {
    const updated = {
      ...this.props.data,
      defaultIssueTypeClosedStatusId: option.id
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  selectResolution = (option: *) => {
    const updated = {
      ...this.props.data,
      defaultResolutionId: option.id
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  render() {
    const { data, jiraData } = this.props;
    const { selectedIssueType } = this.state;
    let selectedIssueTypeStatuses = [];
    if (selectedIssueType) {
      selectedIssueTypeStatuses = selectedIssueType.statuses;
    }
    return (
      <FormSection name="defaults">
        <MinWidthFieldWrapper>
          <Field label="Pick default Issue Type" name="defaultIssueTypeId">
            {() => (
              <Select
                options={jiraData.jiraIssueTypes}
                getOptionValue={getDefaultOptionValue}
                getOptionLabel={getIconUrlOptionLabel}
                onChange={this.selectDefaultIssueType}
                defaultValue={idFind(
                  data.defaultIssueTypeId,
                  jiraData.jiraIssueTypes
                )}
              />
            )}
          </Field>
          <Field
            label="Pick Closed Status"
            name="defaultIssueTypeClosedStatusId"
          >
            {() => (
              <Select
                options={selectedIssueTypeStatuses}
                getOptionValue={getDefaultOptionValue}
                getOptionLabel={getStatusOptionLabel}
                onChange={this.selectClosedStatus}
                defaultValue={idFind(
                  data.defaultIssueTypeClosedStatusId,
                  selectedIssueTypeStatuses,
                  false
                )}
              />
            )}
          </Field>
          <Field label="Pick Default Resolution" name="defaultResolutionId">
            {() => (
              <Select
                options={jiraData.jiraResolutions}
                getOptionValue={getDefaultOptionValue}
                getOptionLabel={getIconUrlOptionLabel}
                onChange={this.selectResolution}
                defaultValue={idFind(
                  data.defaultResolutionId,
                  jiraData.jiraResolutions
                )}
              />
            )}
          </Field>
        </MinWidthFieldWrapper>
      </FormSection>
    );
  }
}
