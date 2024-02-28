import { Controller, Get, Query, Render } from '@nestjs/common';
import { GithubService } from './github/github.service';

@Controller()
export class AppController {
  constructor(readonly githubService: GithubService) {}
  private result: any[];
  private error: string;

  @Get()
  @Render('index')
  async root(@Query('url') url?: string) {
    if (url) {
      try {
        this.result =
          await this.githubService.getReposWithSimilarContributors(url);
      } catch (error) {
        this.error = error.response.message;
      }

      return { result: this.result, url, error: this.error };
    }

    return { url };
  }
}
