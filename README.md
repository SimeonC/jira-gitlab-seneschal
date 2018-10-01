# jira-gitlab-seneschal

A tool for migrating to and managing issues in JIRA and Git in GitLab.

### Migration Notes

The transitions scripts require you to enable "All statuses can transition to '...'" for all statuses you want to map to. This allows us to map the gitlab column "Labels" to their equivalent "Statuses" in JIRA.

### First Time installation

First time you run this product you need to update `config.json` to complete your own setup.
This is a requirement for creating your own private add-on.

Whether running in dev or production modes you need to provide a 32 character string as the value for `"credentialDbKey"` in `config.json`.

If you are running in dev mode follow the instructions for "The Dev Loop" here; https://bitbucket.org/atlassian/atlassian-connect-express
