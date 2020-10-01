// @flow
import React, { Component } from 'react';
import { ApolloConsumer } from '@apollo/client';
import { gql } from '@apollo/client';
import moment from 'moment';

import ReactJson from 'react-json-view';
import Page, { GridColumn } from '@atlaskit/page';
import DynamicTable from '@atlaskit/dynamic-table';
import Button, { ButtonGroup } from '@atlaskit/button';
import Pagination from '@atlaskit/pagination';

const failureQuery = gql`
  query GetFailures($pageSize: Int, $pageOffset: Int!) {
    webhookErrors(pageOffset: $pageOffset, pageSize: $pageSize) {
      page
      totalPages
      rows {
        id
        original
        error
        createdAt
      }
    }
  }
`;

const retryQuery = gql`
  mutation RetryFailure($id: String!) {
    retryWebhook(id: $id) {
      success
    }
  }
`;

const deleteQuery = gql`
  mutation DeleteFailure($id: String!) {
    deleteWebhookFailure(id: $id) {
      success
    }
  }
`;

const deleteAllQuery = gql`
  mutation ClearLogs {
    deleteAllWebhookFailures {
      success
    }
  }
`;

class WebhookErrors extends Component<
  { client: * },
  {
    page: number,
    pages: number[],
    isLoading: boolean,
    rows: *[]
  }
> {
  state = {
    page: 1,
    pages: [],
    isLoading: true,
    rows: []
  };

  componentDidMount() {
    this.loadPage(this.state.page);
  }

  loadPage = (page: number) => {
    this.setState({ page });
    this.props.client
      .query({
        query: failureQuery,
        variables: {
          pageOffset: page - 1
        },
        fetchPolicy: 'no-cache'
      })
      .then(({ data = {} }) => {
        const pages = [];
        for (let i = 0; i < data.webhookErrors.totalPages; i += 1) {
          pages.push(i);
        }
        this.setState({
          isLoading: false,
          pages,
          rows: data.webhookErrors.rows.map(
            ({ id, original, error, createdAt }) => ({
              key: id,
              cells: [
                {
                  key: 'date',
                  content: moment(parseInt(createdAt, 10)).format(
                    'YYYY-MM-DD HH:mm'
                  )
                },
                {
                  key: 'error',
                  content: (
                    <ReactJson
                      collapsed={1}
                      enableClipboard={false}
                      src={JSON.parse(error)}
                    />
                  )
                },
                {
                  key: 'original',
                  content: (
                    <ReactJson
                      collapsed={1}
                      enableClipboard={false}
                      src={JSON.parse(original)}
                    />
                  )
                },
                {
                  key: 'actions',
                  content: (
                    <ButtonGroup>
                      <Button onClick={() => this.retryError(id)}>Retry</Button>
                      <Button
                        onClick={() => this.deleteError(id)}
                        appearance="danger"
                      >
                        Delete
                      </Button>
                    </ButtonGroup>
                  )
                }
              ]
            })
          )
        });
      });
  };

  retryError = (id: string) => {
    this.setState({ isLoading: true });
    this.props.client
      .mutate({
        mutation: retryQuery,
        variables: { id }
      })
      .then(({ data = {} }) => {
        if (!data.retryWebhook.success) {
          console.error(data);
          this.setState({
            isLoading: false
          });
        } else {
          this.loadPage(this.state.page);
        }
      });
  };

  deleteError = (id: string) => {
    this.setState({ isLoading: true });
    this.props.client
      .mutate({
        mutation: deleteQuery,
        variables: { id }
      })
      .then(({ data = {} }) => {
        if (!data.deleteWebhookFailure.success) {
          console.error(data);
          this.setState({
            isLoading: false
          });
        } else {
          this.loadPage(this.state.page);
        }
      });
  };

  deleteAllErrors = () => {
    // eslint-disable-next-line
    if (!confirm('Are you sure you want to clear all errors?')) return;
    this.setState({ isLoading: true });
    this.props.client
      .mutate({
        mutation: deleteAllQuery
      })
      .then(({ data = {} }) => {
        if (!data.deleteAllWebhookFailures.success) {
          console.error(data);
          this.setState({
            isLoading: false
          });
        } else {
          this.loadPage(1);
        }
      });
  };

  render() {
    const { rows, isLoading, page, pages } = this.state;
    return (
      <Page>
        <GridColumn>
          <div>
            <Button appearance="danger" onClick={this.deleteAllErrors}>
              Clear all Error Logs
            </Button>
          </div>
          <div>
            <DynamicTable
              isFixedSize
              isLoading={isLoading}
              onSetPage={this.loadPage}
              caption={<h4>Webhook Errors (Newest First)</h4>}
              emptyView={<div>No Errors</div>}
              head={{
                cells: [
                  {
                    key: 'createdAt',
                    content: 'Created At',
                    isSortable: false,
                    width: '120px'
                  },
                  {
                    key: 'error',
                    content: 'Error',
                    isSortable: false
                  },
                  {
                    key: 'original',
                    content: 'Original',
                    isSortable: false
                  },
                  {
                    key: 'actions',
                    content: '',
                    isSortable: false,
                    width: '140px'
                  }
                ]
              }}
              rows={rows}
            />
          </div>
          <div>
            <Pagination
              onChange={this.loadPage}
              getPageLabel={(page) => page + 1}
              selectedIndex={page}
              pages={pages}
            />
          </div>
        </GridColumn>
      </Page>
    );
  }
}

export default () => (
  <ApolloConsumer>
    {(client) => <WebhookErrors client={client} />}
  </ApolloConsumer>
);
