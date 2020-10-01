import { gql, useMutation, useQuery } from '@apollo/client';
import { ToggleStateless } from '@atlaskit/toggle';
import Spinner from '@atlaskit/spinner';
import React from 'react';

const Toggle = ({
  name,
  label,
  enableLabel,
  disableLabel,
  invertDisplay
}: {
  name: string,
  label?: string,
  enableLabel?: string,
  disableLabel?: string,
  invertDisplay?: boolean
}) => {
  const getSettingQuery = gql`
      query GetSetting {
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
  if (invertDisplay) {
    isChecked = !isChecked;
  }
  let textDisplay = label;
  if (isChecked && enableLabel) {
    textDisplay = enableLabel;
  } else if (!isChecked && disableLabel) {
    textDisplay = disableLabel;
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
      {textDisplay} {isSaving && <Spinner />}
    </div>
  );
};

export default Toggle;
