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
  MinWidthFieldWrapper
} from './utils';
import type { TransitionMappingPriorityType } from '../../../server/transition/types';

type PropsType = {
  jiraData: *,
  data: *,
  labels: string[],
  update: any
};

const FormRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;

  & > *:not(:last-child) {
    margin-right: 12px;
  }
`;

export default class PrioritiesMappings extends Component<PropsType> {
  update = (index: number, component: *) => {
    const priorities = [...this.props.data.priorities];
    priorities.splice(index, 1, component);
    const updated = {
      ...this.props.data,
      priorities
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  remove = (index: number) => {
    const priorities = [...this.props.data.priorities];
    priorities.splice(index, 1);
    const updated = {
      ...this.props.data,
      priorities
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  add = () => {
    const priorities = [...this.props.data.priorities];
    priorities.push({});
    const updated = {
      ...this.props.data,
      priorities
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
      <FormSection name="priorities">
        <MinWidthFieldWrapper>
          <h3>Map GitLab labels to priorities</h3>
          {data.priorities.map((component, index) => (
            <PriorityMapping
              key={index}
              tags={labels}
              jiraData={jiraData}
              index={index}
              data={component}
              update={this.update}
              remove={this.remove}
            />
          ))}
          <Button appearance="primary" onClick={this.add}>
            Add New Priority Mapping
          </Button>
        </MinWidthFieldWrapper>
      </FormSection>
    );
  }
}

type PriorityPropsType = {
  index: number,
  tags: string[],
  jiraData: *,
  data: TransitionMappingPriorityType,
  update: (index: number, map: *) => void,
  remove: (index: number) => void
};

class PriorityMapping extends Component<PriorityPropsType> {
  remove = () => {
    this.props.remove(this.props.index);
  };

  selectComponent = (option: *) => {
    this.props.update(this.props.index, {
      ...this.props.data,
      priorityId: option.id
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
    return (
      <FormRow>
        <Field label="Pick GitLab Tag">
          <Select
            options={tags.map((tag) => ({ value: tag, label: tag }))}
            onChange={this.selectTag}
            defaultValue={{ label: data.gitlabLabel }}
          />
        </Field>
        <Field label="Pick Priority">
          <Select
            options={jiraData.jiraPriorities}
            getOptionValue={getDefaultOptionValue}
            getOptionLabel={getIconUrlOptionLabel}
            onChange={this.selectComponent}
            defaultValue={idFind(data.priorityId, jiraData.jiraPriorities)}
          />
        </Field>
        <Button onClick={this.remove}>Delete</Button>
      </FormRow>
    );
  }
}
