import React from 'react';
import { useMutation, useQuery } from '@apollo/client';
import startCase from 'lodash/startCase';
import { gql } from '@apollo/client';
import Tabs from '@atlaskit/tabs';
import { ToggleStateless } from '@atlaskit/toggle';
import Spinner from '@atlaskit/spinner';
import GitlabTokenForm from './GitlabTokenForm';
import JiraOauthForm from './JiraOauthForm';

const SETTINGS_QUERY = gql`
  query AppSettings {
    appSettings {
      useGlances
    }
  }
`;

function SettingRow({ data, id: key }: *) {
  if (!data) return null;
  const [setSetting, { loading: isSaving }] = useMutation(gql`
    mutation SetAppSetting($key: String!, $value: String!) {
      setAppSetting(key: $key, value: $value) {
        success
      }
    }
  `);
  const isChecked = data[key] === 'true';
  return (
    <div>
      <ToggleStateless
        size="large"
        isChecked={isChecked}
        isDisabled={isSaving}
        onChange={() => {
          const value = isChecked ? 'false' : 'true';
          setSetting({
            variables: { key, value },
            update: (store) => {
              store.writeQuery({
                query: SETTINGS_QUERY,
                data: {
                  appSettings: {
                    ...data,
                    [key]: value
                  }
                }
              });
            }
          });
        }}
      />{' '}
      {startCase(key)} {isSaving && <Spinner />}
    </div>
  );
}

function Settings() {
  const { loading, data = {} } = useQuery(SETTINGS_QUERY);
  return (
    <div>
      {loading && <Spinner />}
      {!loading && (
        <div>
          <SettingRow data={data.appSettings} id="useGlances" />
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  return (
    <Tabs
      tabs={[
        { label: 'Settings', content: <Settings /> },
        { label: 'Authentication', content: <GitlabTokenForm /> },
        { label: 'Dev Tools', content: <JiraOauthForm /> }
      ]}
    />
  );
}
