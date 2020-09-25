// @flow
import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';
import Page, { Grid, GridColumn } from '@atlaskit/page';
import { useQuery } from '@apollo/client';
import DynamicTable from '@atlaskit/dynamic-table';
import Lozenge from '@atlaskit/lozenge';
import Button, { ButtonGroup } from '@atlaskit/button';
import TextField from '@atlaskit/textfield';
import type { WebhookProjectStatusEnumType } from '../../server/apis/webhooks.types';
import { useUpdateWebhook, webhooksQuery } from './useWebhooks';

const Spaced = styled.div`
  margin-bottom: 12px;
`;

const statusColor = (status: WebhookProjectStatusEnumType) => {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'sick':
      return 'removed';
    case 'pending':
      return 'inprogress';
    default:
      return 'default';
  }
};

const Status = () => {
  const { loading, data = {} } = useQuery(webhooksQuery);
  const [upsertWebhook] = useUpdateWebhook();
  const [filterInput, setFilterInput] = useState('');
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilter(filterInput);
    }, 200);
    return () => {
      clearTimeout(handler);
    };
  }, [filterInput, setFilter]);

  let rows = data.webhooks || [];
  if (statusFilter || (filter && filter.trim() !== '')) {
    rows = rows.filter((webhook) => {
      const lFilter = (filter || '').trim().toLowerCase();
      return (
        (!statusFilter || webhook.status === statusFilter) &&
        (!lFilter ||
          webhook.url.toLowerCase().indexOf(lFilter) >= 0 ||
          webhook.name.toLowerCase().indexOf(lFilter) >= 0)
      );
    });
  }
  rows = rows.map((webhook) => ({
    key: webhook.id,
    cells: [
      {
        key: 'name',
        content: (
          <a href={webhook.url} target="_blank">
            {webhook.name}
          </a>
        )
      },
      {
        key: 'status',
        content: (
          <div>
            <Lozenge
              appearance={
                webhook.outOfDate ? 'moved' : statusColor(webhook.status)
              }
            >
              {startCase(webhook.status)}
            </Lozenge>
            {(webhook.status === 'sick' ||
              webhook.status === 'pending' ||
              webhook.outOfDate) && (
              <Button onClick={() => upsertWebhook(webhook.id)}>
                Update Webhook
              </Button>
            )}
          </div>
        )
      }
    ]
  }));

  return (
    <Page>
      <GridColumn>
        <Grid style={{ marginTop: 16 }}>
          <Spaced>
            <TextField
              placeholder="Search..."
              value={filterInput}
              type="search"
              onChange={(event) =>
                setFilterInput(event.currentTarget.value || '')
              }
            />
          </Spaced>
        </Grid>
        <Grid style={{ marginTop: 16 }}>
          <Spaced>
            <ButtonGroup>
              {['healthy', 'sick', 'pending'].map((status) => (
                <Button
                  key={status}
                  onClick={() =>
                    setStatusFilter(statusFilter === status ? '' : status)
                  }
                  appearance={statusFilter === status ? 'primary' : undefined}
                >
                  <Lozenge appearance={statusColor(status)}>
                    {startCase(status)}
                  </Lozenge>
                </Button>
              ))}
            </ButtonGroup>
          </Spaced>
        </Grid>
        <Grid>
          <Spaced>
            <DynamicTable
              isFixedSize
              caption={<h4 style={{ marginTop: 0 }}>Projects with webhooks</h4>}
              head={{
                cells: [
                  {
                    key: 'name',
                    content: 'Project Name',
                    isSortable: true,
                    shouldTruncate: true
                  },
                  {
                    key: 'status',
                    content: 'Status',
                    isSortable: false
                  }
                ]
              }}
              rows={rows}
              isLoading={loading}
            />
          </Spaced>
        </Grid>
      </GridColumn>
    </Page>
  );
};

export default Status;
