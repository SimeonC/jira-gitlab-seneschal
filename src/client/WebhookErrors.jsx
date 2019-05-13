// @flow
import React, { Component } from 'react';
import { ApolloConsumer } from 'react-apollo';
import gql from 'graphql-tag';
import moment from 'moment';

import ReactJson from 'react-json-view';
import Page, { Grid, GridColumn } from '@atlaskit/page';
import DynamicTable from '@atlaskit/dynamic-table';
import Button from '@atlaskit/button';
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

class WebhookErrors extends Component<
  { client: * },
  {
    page: number,
    pages: number,
    isLoading: boolean,
    rows: *[]
  }
> {
  state = {
    page: 1,
    pages: 0,
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
      .then(({ data }) => {
        this.setState({
          isLoading: false,
          pages: data.webhookErrors.totalPages,
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
                  content: <ReactJson src={JSON.parse(error)} />
                },
                {
                  key: 'original',
                  content: <ReactJson src={JSON.parse(original)} />
                },
                {
                  key: 'retry',
                  content: (
                    <Button onClick={() => this.retryError(id)}>Retry</Button>
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
      .then(({ data }) => {
        if (!data.success) {
          console.error(data);
        }
        this.loadPage(this.state.page);
      });
  };

  render() {
    const { rows, isLoading, page, pages } = this.state;
    return (
      <Page>
        <GridColumn>
          <Grid>
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
                    isSortable: false
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
                    key: 'retry',
                    content: '',
                    isSortable: false
                  }
                ]
              }}
              rows={rows}
            />
          </Grid>
          <Grid>
            <Pagination onChange={this.loadPage} value={page} total={pages} />
          </Grid>
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
