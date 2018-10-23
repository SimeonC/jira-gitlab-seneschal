import cases from 'jest-in-case';
import markdownTransform from '../markdownTransform';

const web_url = 'test web url';

const gitlabApi = {
  Projects: {
    show: () => Promise.resolve({ web_url })
  }
};

cases(
  'markdownTransform',
  async ({ markdown, result }) => {
    expect(await markdownTransform(gitlabApi, '', markdown)).toBe(result);
  },
  [
    {
      name: 'text without markup',
      markdown: 'Some normal text with/na line break in it for good measure',
      result: 'Some normal text with/na line break in it for good measure'
    },
    {
      name: 'images',
      markdown: '![image](http://url)',
      result: '!http://url|width="100%"!'
    },
    {
      name: 'relative images',
      markdown: '![image](/url)',
      result: `!${web_url}/url|width="100%"!`
    },
    {
      name: 'links',
      markdown: '[text](/url)',
      result: '[text|/url]'
    },
    {
      name: 'links and images',
      markdown: '![image](http://image-url)\n[text](/url)',
      result: '!http://image-url|width="100%"!\n[text|/url]'
    },
    {
      name: 'strikethrough',
      markdown: '~~strikethrough~~',
      result: '-strikethrough-'
    },
    {
      name: 'emphasis',
      markdown: '_something_ *emphasis*',
      result: '_something_ _emphasis_'
    },
    {
      name: 'bold',
      markdown: '**something** __bold__',
      result: '*something* *bold*'
    },
    {
      name: 'bold and emphasis',
      markdown: 'something **_one_** __*two*__ _**three**_',
      result: 'something *_one_* *two* _*three*_'
    },
    {
      name: 'headers at start',
      markdown: '### header',
      result: 'h3. header'
    },
    {
      name: 'headers on newline',
      markdown: '\n### header',
      result: '\nh3. header'
    },
    {
      name: 'headers with whitespace',
      markdown: '   ### header',
      result: 'h3. header'
    },
    {
      name: 'inline code',
      markdown: 'some `inline` code',
      result: 'some {{inline}} code'
    },
    {
      name: 'multiline code',
      markdown: 'some ```multiline code\nnot inline``` code',
      result: 'some {code}multiline code\nnot inline{code} code'
    }
  ]
);
