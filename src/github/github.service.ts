import { BadRequestException, Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { IGithubContributions, IGithubContributors } from './github.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubService {
  constructor(private configService: ConfigService) {}

  async getReposWithSimilarContributors(url: string) {
    try {
      const token = this.configService.get<string>('githubToken');
      let headers = {};
      if (token) {
        headers = { Authorization: `Bearer ${token}` };
      }

      // return [
      //   {
      //     name: '1',
      //     link: 'https://github.com/nestjsx/nestjs-config/issues/49',
      //     matches: 5,
      //   },
      //   {
      //     name: '2',
      //     link: 'https://github.com/nestjsx/nestjs-config/issues/49',
      //     matches: 51,
      //   },
      //   {
      //     name: '3',
      //     link: 'https://github.com/nestjsx/nestjs-config/issues/49',
      //     matches: 25,
      //   },
      // ];

      const urlSplit = url.split('/');
      if (urlSplit.length < 2) {
        throw new BadRequestException('Incorrect URL!');
      }
      const owner = urlSplit[urlSplit.length - 2];
      const repo = urlSplit[urlSplit.length - 1];

      // const token = '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'; //'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';

      const contributorsMain = await this.getContributors(
        `${owner}/${repo}`,
        headers,
      );

      console.log('COUNT OF contributorsMain:', contributorsMain.length);

      const contributionsRepos = await this.getContributions(
        contributorsMain,
        headers,
      );

      console.log('COUNT OF contributionsRepos:', contributionsRepos.length);

      const uniqueContributionsRepos = this.removeDuplicates(
        contributionsRepos,
        repo,
      );

      console.log(
        'COUNT OF uniqueContributionsRepos:',
        uniqueContributionsRepos,
      );

      const matches = await this.getContributorsMatches(
        uniqueContributionsRepos,
        contributorsMain,
        headers,
      );

      const sortedMatches = matches.sort(this.compareObjectsByField('matches'));

      console.log('==================== matches', sortedMatches.slice(0, 5));
      return sortedMatches.slice(0, 5).map((item) => {
        return {
          ...item,
          link: `https://github.com/${item.name}`,
        };
      });
    } catch (error) {
      console.log('================ ERROR', error?.response?.data || error);
      //throw new Error("Не вдалося отримати список контриб'юторів");
      throw error;
    }
  }

  async getContributors(
    ownerAndRepo: string,
    headers: { Authorization: string } | {},
  ): Promise<string[]> {
    const contributors: string[] = [];
    let countOfContributorsOnCurrentPage = 0;
    let page = 1;

    do {
      try {
        const contributorsMainCurrentRes: AxiosResponse<IGithubContributors[]> =
          await axios.get(
            `https://api.github.com/repos/${ownerAndRepo}/contributors?per_page=100&page=${page}`,
            { headers },
          );

        const contributorsMainCurrent = contributorsMainCurrentRes.data.map(
          (contributor) => contributor.login,
        );

        contributors.push(...contributorsMainCurrent);

        countOfContributorsOnCurrentPage = contributorsMainCurrent.length;
        page++;
      } catch (error) {
        console.log(`WARNING FOR ${ownerAndRepo}:`, error.response);
        // throw new UnprocessableEntityException('Incorrect URL!');
      }
    } while (countOfContributorsOnCurrentPage !== 0);

    return contributors;
  }

  async getContributions(contributors: string[], headers): Promise<string[]> {
    const contributionsRepos: string[] = [];

    const contributionsPromises = contributors.map(async (item) => {
      console.log(`===`, item);
      const contributionsRes: AxiosResponse<IGithubContributions[]> =
        await axios.get(`https://api.github.com/users/${item}/events`, {
          headers,
        });

      // Filter events to get only contributions
      const contributions = contributionsRes.data.filter(
        (event) =>
          event.type === 'PushEvent' || event.type === 'PullRequestEvent',
      );
      const currentContributionsRepo = contributions.map(
        (contribution) => contribution.repo.name,
      );
      contributionsRepos.push(...currentContributionsRepo);
    });

    await Promise.all(contributionsPromises);

    return contributionsRepos;
  }

  async getContributorsMatches(
    contributionsRepos: string[],
    contributorsMain: string[],
    headers,
  ) {
    const matches = [];

    const subContributorsPromises = contributionsRepos.map(async (item) => {
      console.log(`========`, item);
      const contributorsSub = await this.getContributors(item, headers);

      matches.push({
        name: item,
        matches: this.countMatches(contributorsMain, contributorsSub),
      });
    });

    await Promise.all(subContributorsPromises);

    return matches;
  }

  removeDuplicates(contributions, mainRepository) {
    const repositories = {};
    const result = [];

    for (const contribution of contributions) {
      const [author, repository] = contribution
        .split('/')
        .map((str) => str.trim());

      if (!repositories[repository] && repository !== mainRepository) {
        repositories[repository] = true;
        result.push(contribution);
      }
    }

    return result;
  }

  countMatches(array1, array2) {
    const matches = array1.filter((item) => array2.includes(item));
    return matches.length;
  }

  compareObjectsByField(field) {
    return function (a, b) {
      if (a[field] < b[field]) {
        return 1;
      }
      if (a[field] > b[field]) {
        return -1;
      }
      return 0;
    };
  }
}
