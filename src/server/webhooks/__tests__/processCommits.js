import cases from 'jest-in-case';
import { processCommits } from '../mergeRequest';

const transitionKeywords = ['fix', 'fixes', 'fixed'];
const projectKeys = ['TC', 'NAS'];

cases(
  'processCommits',
  ({ commits, results }) => {
    expect(
      processCommits(
        transitionKeywords,
        projectKeys,
        commits.map((m) => ({ title: 'title', message: m }))
      )
    ).toEqual(results);
    expect(
      processCommits(
        transitionKeywords,
        projectKeys,
        commits.map((m) => ({ title: m, message: 'message' }))
      )
    ).toEqual(results);
  },
  [
    {
      name: 'no ticket links',
      commits: ['did something'],
      results: []
    },
    {
      name: 'invalid project link',
      commits: ['did something OFF-12'],
      results: []
    },
    {
      name: 'basic multi commit',
      commits: ['did something TC-12', 'did something NAS-12'],
      results: [
        { issueKey: 'TC-12', shouldTransition: false },
        { issueKey: 'NAS-12', shouldTransition: false }
      ]
    },
    {
      name: 'non-transition link in message',
      commits: ['did something TC-12'],
      results: [{ issueKey: 'TC-12', shouldTransition: false }]
    },
    {
      name: 'multiple non-transition link in message',
      commits: ['did something TC-12, NAS-42'],
      results: [
        { issueKey: 'TC-12', shouldTransition: false },
        { issueKey: 'NAS-42', shouldTransition: false }
      ]
    },
    {
      name: 'exact transitioning link in message',
      commits: ['did something fixes TC-12'],
      results: [{ issueKey: 'TC-12', shouldTransition: true }]
    },
    {
      name: 'case insensitive transitioning link in message',
      commits: ['did something FIXES TC-12'],
      results: [{ issueKey: 'TC-12', shouldTransition: true }]
    },
    {
      name: 'multiple transitioning link in message',
      commits: ['did something FIXES TC-12, NAS-42'],
      results: [
        { issueKey: 'TC-12', shouldTransition: true },
        { issueKey: 'NAS-42', shouldTransition: true }
      ]
    },
    {
      name: 'combinations of stuff',
      commits: [
        'NAS-2, TC-3 and BOT-3 did something, FIXES TC-12, NAS-42 AND TC-14',
        'NAS-2 did something else and Fixes TC-8 and NAS-42'
      ],
      results: [
        { issueKey: 'NAS-2', shouldTransition: false },
        { issueKey: 'TC-3', shouldTransition: false },
        { issueKey: 'TC-12', shouldTransition: true },
        { issueKey: 'NAS-42', shouldTransition: true },
        { issueKey: 'TC-14', shouldTransition: true },
        { issueKey: 'TC-8', shouldTransition: true }
      ]
    }
  ]
);
