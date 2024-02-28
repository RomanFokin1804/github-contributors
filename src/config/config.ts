import * as process from 'process';

export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  githubToken: process.env.GITHUB_TOKEN,
});
