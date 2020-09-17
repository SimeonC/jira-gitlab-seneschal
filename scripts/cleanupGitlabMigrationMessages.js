const GitlabApi = require('@gitbeaker/node').default;
const inquirer = require('inquirer');
const progress = require('progress');
const chalk = require('chalk');

// Use this prompt to cleanup any failed migrations so you don't port over the migration text again from gitlab

function cleanDescription(descr) {
  return descr.replace(/^(Migrated to: \[([^\]]+)\]\([^)]+\)\W+)+/gi, '');
}

inquirer.registerPrompt(
  'autocomplete',
  require('inquirer-autocomplete-prompt')
);

inquirer
  .prompt([
    { type: 'input', name: 'url', message: 'Enter gitlab Url' },
    { type: 'input', name: 'token', message: 'Enter gitlab API Token' }
  ])
  .then(async ({ url, token }) => {
    console.log(chalk.cyan('Loading Gitlab Projects'));

    const api = new GitlabApi({
      url,
      token
    });

    let projects;
    return inquirer
      .prompt([
        {
          type: 'autocomplete',
          name: 'project',
          message: 'Select a project to clean',
          source: (answersSoFar, input) => {
            return api.Projects.all({
              search: input,
              membership: true,
              archived: false,
              simple: true
            }).then((returnedProjects) => {
              projects = returnedProjects;
              return projects.map((project) => {
                project.name = project.name_with_namespace;
                return project;
              });
            });
          }
        }
      ])
      .then(async ({ project: projectNameWithNamespace }) => {
        console.log(chalk.blue('Processing Project'));
        console.log(chalk.blue('Loading issues...'));
        const project = projects.find(
          ({ name_with_namespace }) =>
            name_with_namespace === projectNameWithNamespace
        );
        if (!project || !project.id) {
          console.log(chalk.red('Project not found'));
          return;
        }
        const issues = await api.Issues.all({
          projectId: project.id
        });
        const bar = new progress(':bar :current / :total', {
          total: issues.length
        });
        issues.forEach(async (issue) => {
          const cleanedDescription = cleanDescription(issue.description || '');
          await api.Issues.edit(project.id, issue.iid, {
            description: cleanedDescription
          });
          bar.tick();
        });
      });
  })
  .catch((error) => console.error(error));
