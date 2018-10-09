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
  getComponentOptionLabel,
  MinWidthFieldWrapper
} from './utils';
import type {
  TransitionMappingComponentType,
  TransitionMappingType
} from '../../../server/transition/types';

type PropsType = {
  jiraData: *,
  data: TransitionMappingType,
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

export default class ComponentMappings extends Component<PropsType> {
  update = (index: number, component: *) => {
    const components = [...this.props.data.components];
    components.splice(index, 1, component);
    const updated = {
      ...this.props.data,
      components
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  remove = (index: number) => {
    const components = [...this.props.data.components];
    components.splice(index, 1);
    const updated = {
      ...this.props.data,
      components
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  add = () => {
    const components = [...this.props.data.components];
    components.push({});
    const updated = {
      ...this.props.data,
      components
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
      <FormSection name="components">
        <MinWidthFieldWrapper>
          <h3>Map GitLab labels to components</h3>
          {data.components.map((component, index) => (
            <ComponentMapping
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
            Add New Component Mapping
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
  data: TransitionMappingComponentType,
  update: (index: number, issueMap: *) => void,
  remove: (index: number) => void
};

class ComponentMapping extends Component<IssuePropsType> {
  remove = () => {
    this.props.remove(this.props.index);
  };

  selectComponent = (option: *) => {
    this.props.update(this.props.index, {
      ...this.props.data,
      componentId: option.id
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
        <Field label="Pick Component">
          <Select
            options={jiraData.jiraComponents}
            getOptionValue={getDefaultOptionValue}
            getOptionLabel={getComponentOptionLabel}
            onChange={this.selectComponent}
            defaultValue={idFind(data.componentId, jiraData.jiraComponents)}
          />
        </Field>
        <Button onClick={this.remove}>Delete</Button>
      </FormRow>
    );
  }
}
