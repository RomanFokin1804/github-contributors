import { Controller, Get, Query, Render } from '@nestjs/common';
import { GithubService } from './github/github.service';

@Controller()
export class AppController {
  constructor(readonly githubService: GithubService) {}
  private result: any[];

  @Get()
  @Render('index')
  async root(@Query('url') url?: string) {
    if (url) {
      this.result =
        await this.githubService.getReposWithSimilarContributors(url);
      return { result: this.result, url };
    }

    return { url };
  }
}
