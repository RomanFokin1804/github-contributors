import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import {
  IGetReposWithSimilarContributorsRes,
  IGithubContributions,
  IGithubContributors,
} from './github.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubService {
  constructor(private configService: ConfigService) {}

  async getReposWithSimilarContributors(
    url: string,
  ): Promise<IGetReposWithSimilarContributorsRes[]> {
    try {
      const token = this.configService.get<string>('githubToken');
      let headers = {};
      if (token) {
        headers = { Authorization: `Bearer ${token}` };
      }

      const urlSplit = url.split('/');
      if (urlSplit.length < 2) {
        throw new BadRequestException('Incorrect URL!');
      }
      const owner = urlSplit[urlSplit.length - 2];
      const repo = urlSplit[urlSplit.length - 1];

      const contributorsMain = await this.getContributors(
        `${owner}/${repo}`,
        headers,
      );

      if (contributorsMain.length === 0) {
        throw new NotFoundException(
          'Contributors for this repository were not found. Possible reasons: ' +
            '1. The URL is entered incorrectly; ' +
            '2. The number of contributors is too large to process using the GitHub API; ' +
            '3. This repository has no contributors.',
        );
      }

      const contributionsRepos = await this.getContributions(
        contributorsMain,
        headers,
      );

      const uniqueContributionsRepos = this.removeDuplicates(
        contributionsRepos,
        repo,
      );

      const matches = await this.getContributorsMatches(
        uniqueContributionsRepos,
        contributorsMain,
        headers,
      );

      const sortedMatches = matches.sort(this.compareObjectsByField('matches'));

      return sortedMatches.slice(0, 5).map((item) => {
        return {
          ...item,
          link: `https://github.com/${item.name}`,
        };
      });
    } catch (error) {
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
            `https://api.github.com/repos/${ownerAndRepo}/contributors?per_page=10&page=${page}`,
            { headers },
          );

        const contributorsMainCurrent = contributorsMainCurrentRes.data.map(
          (contributor) => contributor.login,
        );

        contributors.push(...contributorsMainCurrent);

        countOfContributorsOnCurrentPage = contributorsMainCurrent.length;
        page++;
      } catch (error) {
        // console.log(
        //   `WARNING FOR ${ownerAndRepo}:`,
        //   error.response.status,
        //   error.response.statusText,
        //   error.response.data,
        // );
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
