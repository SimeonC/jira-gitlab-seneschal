# jira-gitlab-seneschal

<p align="center">
    <a href="#docker-stars" alt="Stars on docker">
        <img src="https://img.shields.io/docker/stars/simeonc/jira-gitlab-seneschal.svg" />
    </a>
    <a href="#docker-pulls" alt="Pulls on docker">
        <img src="https://img.shields.io/docker/pulls/simeonc/jira-gitlab-seneschal.svg" />
    </a>
    <a href="#docker-auto-build" alt="Docker Automated Build">
        <img src="https://img.shields.io/docker/automated/simeonc/jira-gitlab-seneschal.svg" />
    </a>
    <a href="#docker-status" alt="Docker Status">
        <img src="https://img.shields.io/docker/build/simeonc/jira-gitlab-seneschal.svg" />
    </a>
</p>

A tool for migrating to and managing issues in JIRA and Git in GitLab.

### Migration Notes

The transitions scripts require you to enable "All statuses can transition to '...'" for all statuses you want to map to. This allows us to map the gitlab column "Labels" to their equivalent "Statuses" in JIRA.

### First Time installation

First time you run this product you need to update `config.json` to complete your own setup.
This is a requirement for creating your own private add-on.

Whether running in dev or production modes you need to provide a 32 character string as the value for `"credentialDbKey"` in `config.json`.

If you are running in dev mode follow the instructions for "The Dev Loop" here; https://bitbucket.org/atlassian/atlassian-connect-express

#### ENV Vars Documentation

When running in production the following ENV Vars should be defined as follows;

| var                     | usage                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `$PORT`                 | Server Port to run express server on                         |
| `$APP_URL`              | Url that the addon will run on                               |
| `$DATABASE_URL`         | Url of the Postgres database to connect to                   |
| `$JIRA_HOST`            | Host domain of your Jira instance, can be a wildcard. If you need more than one in the whitelist I recommend editing the `config.json` file directly. eg `*.atlassian.net` will allow all cloud jira instances. |
| `$LOWDB_CREDENTIAL_KEY` | A 32 character string to encode lowdb files when saving them to disk. |

### Releasing

To release you first need to setup `conventional-github-releaser` by following the instructions here: https://www.npmjs.com/package/conventional-github-releaser#setup-token-for-cli

Then simply run `npm run release` which will automatically tag, update the changelog and create the github release file.

To ensure this system works all commits must follow the [Angular commit conventions](https://github.com/bcoe/conventional-changelog-standard/blob/master/convention.md)