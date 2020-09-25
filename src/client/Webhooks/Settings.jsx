// @flow
import React from 'react';
import { gql, useQuery, useMutation } from '@apollo/client';
import { ToggleStateless } from '@atlaskit/toggle';
import Page from '@atlaskit/page';
import Spinner from '@atlaskit/spinner';

const Toggle = ({ name, label }: { name: string, label: string }) => {
  const getSettingQuery = gql`
      {
          getWebhookSettings {
              ${name}
          }
      }
  `;
  const { loading: isLoading, data } = useQuery(getSettingQuery);
  const [saveSetting, { loading: isSaving }] = useMutation(gql`
    mutation SetWebhookSettings($key: String!, $value: String!) {
      setWebhookSetting(key: $key, value: $value) {
        success
      }
    }
  `);
  let isChecked = false;
  if (!isLoading && data && data.getWebhookSettings) {
    isChecked = data.getWebhookSettings[name] === 'true';
  }
  return (
    <div>
      <ToggleStateless
        size="large"
        isChecked={isChecked}
        isDisabled={isSaving || isLoading}
        onChange={() => {
          const value = isChecked ? 'false' : 'true';
          saveSetting({
            variables: { key: name, value },
            update: (store) => {
              store.writeQuery({
                query: getSettingQuery,
                data: {
                  getWebhookSettings: {
                    [name]: value
                  }
                }
              });
            }
          });
        }}
      />{' '}
      {label} {isSaving && <Spinner />}
    </div>
  );
};

const Settings = () => {
  return (
    <Page>
      <Toggle
        name="autoAdd"
        label="Every 24 hours, check for out of date webhooks and newly added projects and automatically update them."
      />
    </Page>
  );
};

export default Settings;
