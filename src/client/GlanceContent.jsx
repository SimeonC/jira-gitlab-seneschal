import React, { Component } from 'react';
import Spinner from '@atlaskit/spinner';
import Lozenge from '@atlaskit/lozenge';
import Item, { ItemGroup } from '@atlaskit/item';
import Tooltip from '@atlaskit/tooltip';
import Avatar, { AvatarItem } from '@atlaskit/avatar';
import PullRequestIcon from '@atlaskit/icon/glyph/bitbucket/pullrequests';
import PullRequest24Icon from '@atlaskit/icon-object/glyph/pull-request/24';
import ShortcutIcon from '@atlaskit/icon/glyph/shortcut';
import { jiraIssueGlancePropertyKey } from '../server/webhooks/constants';

function getAppearance(status) {
  switch (status) {
    case 'merged':
      return 'success';
    case 'opened':
      return 'new';
    case 'closed':
      return 'removed';
    case 'in progress':
      return 'inprogress';
    case 'locked':
      return 'default';
    default:
      return 'default';
  }
}

export default class Glance extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: true
    };
  }

  componentDidMount() {
    window.AP.context.getContext((response) => {
      try {
        if (response.jira && response.jira.issue && response.jira.issue.key) {
          window.AP.request(
            `/rest/api/3/issue/${
              response.jira.issue.key
            }/properties/${jiraIssueGlancePropertyKey}`
          )
            .then((response) => {
              if (response.body) {
                const content = JSON.parse(response.body);
                if (
                  content.value &&
                  content.value.mergeRequests &&
                  content.value.mergeRequests.length
                ) {
                  this.setState({
                    isLoading: false,
                    content: content.value
                  });
                } else {
                  this.setState({
                    isLoading: false
                  });
                }
              } else {
                console.error('[gitlab seneschal] invalid response', response);
                this.setState({
                  isLoading: false
                });
              }
            })
            .catch((e) => {
              console.error('[gitlab seneschal] error', e);
              this.setState({
                isLoading: false
              });
            });
        } else {
          console.error('[gitlab seneschal] context invalid', response);
          this.setState({ isLoading: false });
        }
      } catch (error) {
        console.error('[gitlab seneschal]', error);
      }
    });
  }

  renderApprover = (user) => {
    return (
      <AvatarItem
        backgroundColor="transparent"
        avatar={
          <Avatar
            src={user.avatarUrls ? user.avatarUrls['32x32'] : user.avatar}
          />
        }
        key={user.key}
        primaryText={user.displayName || user.name}
      />
    );
  };

  render() {
    if (this.state.isLoading) return <Spinner />;
    if (!this.state.content) return <div>No Merge Requests</div>;
    const { mergeRequests } = this.state.content;
    return (
      <ItemGroup>
        {mergeRequests.map((meta) => (
          <Item
            key={meta.mergeRequestUrl}
            href={meta.mergeRequestUrl}
            shouldAllowMultiline
            target="_blank"
            elemBefore={
              meta.relationship === 'transitions' ? (
                <Tooltip content="Causes Transitions">
                  <PullRequest24Icon />
                </Tooltip>
              ) : (
                <Tooltip content="Reference only">
                  <PullRequestIcon />
                </Tooltip>
              )
            }
            elemAfter={
              <Lozenge appearance={getAppearance(meta.status)}>
                {meta.status}
              </Lozenge>
            }
            description={
              meta.relationship === 'transitions' && meta.approvers.length ? (
                <div>
                  <strong>Approved By:</strong>
                  <br />
                  {meta.approvers.map(this.renderApprover)}
                </div>
              ) : null
            }
          >
            <h6 style={{ margin: 0, marginTop: 8 }}>{meta.projectNamespace}</h6>
            <h5 style={{ margin: 0, marginBottom: 8 }}>
              {meta.title} <ShortcutIcon size="small" />
            </h5>
          </Item>
        ))}
      </ItemGroup>
    );
  }
}
