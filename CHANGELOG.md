# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="2.1.1"></a>
## [2.1.1](https://github.com/SimeonC/jira-gitlab-seneschal/compare/v2.1.0...v2.1.1) (2018-10-18)


### Bug Fixes

* **Gitlab:** gitlab projects should be listed ([321206e](https://github.com/SimeonC/jira-gitlab-seneschal/commit/321206e))



<a name="2.1.0"></a>
# [2.1.0](https://github.com/SimeonC/jira-gitlab-seneschal/compare/v2.0.0...v2.1.0) (2018-10-15)


### Bug Fixes

* **datasource:** make sure all data persists ([04d73b4](https://github.com/SimeonC/jira-gitlab-seneschal/commit/04d73b4))
* remove token comments ([34c2968](https://github.com/SimeonC/jira-gitlab-seneschal/commit/34c2968))


### Features

* **Jira:** add in config link and update nav permissions ([38e1fae](https://github.com/SimeonC/jira-gitlab-seneschal/commit/38e1fae))
* **webhooks:** support multiple open/close/merge statuses ([77b98b8](https://github.com/SimeonC/jira-gitlab-seneschal/commit/77b98b8))
* add cleanup cmd line script for failed/rolled back migrations ([0bcb47b](https://github.com/SimeonC/jira-gitlab-seneschal/commit/0bcb47b))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/SimeonC/jira-gitlab-seneschal/compare/v1.4.0...v2.0.0) (2018-10-09)


### Bug Fixes

* **client:** remove eslint warnings ([148c3ff](https://github.com/SimeonC/jira-gitlab-seneschal/commit/148c3ff))
* **Initialising:** provide progress on initial load of issues ([d8954de](https://github.com/SimeonC/jira-gitlab-seneschal/commit/d8954de))
* **loadIssues:** handle stack overflow on recursion ([36c010d](https://github.com/SimeonC/jira-gitlab-seneschal/commit/36c010d))
* **lowdb:** enable development mode ([34f391c](https://github.com/SimeonC/jira-gitlab-seneschal/commit/34f391c))
* **migrationQueue:** prevent stack overflow and handle milestones correctly ([4ab4f8d](https://github.com/SimeonC/jira-gitlab-seneschal/commit/4ab4f8d))
* **transition/markdownTransform:** handle whitespace before header ([f7bbabf](https://github.com/SimeonC/jira-gitlab-seneschal/commit/f7bbabf))


### Features

* **config:** change to `JIRA_HOST` ([a656134](https://github.com/SimeonC/jira-gitlab-seneschal/commit/a656134))


### BREAKING CHANGES

* **config:** `JIRA_HOST_URL` env var has been changed to `JIRA_HOST`



<a name="1.4.0"></a>
# [1.4.0](https://github.com/SimeonC/jira-gitlab-seneschal/compare/v1.3.0...v1.4.0) (2018-10-08)


### Features

* add a dockerfile ([8c57438](https://github.com/SimeonC/jira-gitlab-seneschal/commit/8c57438))



<a name="1.3.0"></a>
# [1.3.0](https://github.com/SimeonC/jira-gitlab-seneschal/compare/v1.2.0...v1.3.0) (2018-10-08)


### Bug Fixes

* **loadIssues:** fix memory crash and make the load more reliable ([0ef8da2](https://github.com/SimeonC/jira-gitlab-seneschal/commit/0ef8da2))
* **Mapper:** milestones for groups should now work ([6098887](https://github.com/SimeonC/jira-gitlab-seneschal/commit/6098887))


### Features

* **Migration:** add polling and cleanup responses ([fcfe84f](https://github.com/SimeonC/jira-gitlab-seneschal/commit/fcfe84f))
* **transintion:** support clearing of broken imports ([b56f5c4](https://github.com/SimeonC/jira-gitlab-seneschal/commit/b56f5c4))



<a name="1.2.0"></a>
# 1.2.0 (2018-10-04)


### Bug Fixes

* **lowdb:** use encryptedKey as first param ([67fe317](https://github.com/SimeonC/jira-gitlab-seneschal/commit/67fe317))
* package version and release script ([3b1017b](https://github.com/SimeonC/jira-gitlab-seneschal/commit/3b1017b))
* release package script ([00bff96](https://github.com/SimeonC/jira-gitlab-seneschal/commit/00bff96))


### Features

* Return Migration Errors ([cdc085d](https://github.com/SimeonC/jira-gitlab-seneschal/commit/cdc085d))
* **migrationQueue:** add Jira link to migrated Gitlab Issue ([d6861e2](https://github.com/SimeonC/jira-gitlab-seneschal/commit/d6861e2))



<a name="1.0.0"></a>
# 1.0.0 (2018-10-03)


### Bug Fixes

* config and build scripts ([51ed79b](https://github.com/SimeonC/jira-gitlab-seneschal/commit/51ed79b))
* load issues for migration ([a3cb693](https://github.com/SimeonC/jira-gitlab-seneschal/commit/a3cb693))
* type errors ([977dc25](https://github.com/SimeonC/jira-gitlab-seneschal/commit/977dc25))


### Features

* add health endpoint ([8fb3ede](https://github.com/SimeonC/jira-gitlab-seneschal/commit/8fb3ede))
* change top level routing to Atlassian nav ([0d680bf](https://github.com/SimeonC/jira-gitlab-seneschal/commit/0d680bf))
* initial display and connections ([a365d9c](https://github.com/SimeonC/jira-gitlab-seneschal/commit/a365d9c))
* working migrations and webhooks ([cac6e9a](https://github.com/SimeonC/jira-gitlab-seneschal/commit/cac6e9a))



<a name="1.1.0"></a>
# 1.1.0 (2018-10-04)


### Bug Fixes

* **lowdb:** use encryptedKey as first param ([67fe317](https://github.com/SimeonC/jira-gitlab-seneschal/commit/67fe317))
* package version and release script ([3b1017b](https://github.com/SimeonC/jira-gitlab-seneschal/commit/3b1017b))


### Features

* Return Migration Errors ([cdc085d](https://github.com/SimeonC/jira-gitlab-seneschal/commit/cdc085d))
* **migrationQueue:** add Jira link to migrated Gitlab Issue ([d6861e2](https://github.com/SimeonC/jira-gitlab-seneschal/commit/d6861e2))



<a name="1.0.0"></a>
# 1.0.0 (2018-10-03)


### Bug Fixes

* config and build scripts ([51ed79b](https://github.com/SimeonC/jira-gitlab-seneschal/commit/51ed79b))
* load issues for migration ([a3cb693](https://github.com/SimeonC/jira-gitlab-seneschal/commit/a3cb693))
* type errors ([977dc25](https://github.com/SimeonC/jira-gitlab-seneschal/commit/977dc25))


### Features

* add health endpoint ([8fb3ede](https://github.com/SimeonC/jira-gitlab-seneschal/commit/8fb3ede))
* change top level routing to Atlassian nav ([0d680bf](https://github.com/SimeonC/jira-gitlab-seneschal/commit/0d680bf))
* initial display and connections ([a365d9c](https://github.com/SimeonC/jira-gitlab-seneschal/commit/a365d9c))
* working migrations and webhooks ([cac6e9a](https://github.com/SimeonC/jira-gitlab-seneschal/commit/cac6e9a))
