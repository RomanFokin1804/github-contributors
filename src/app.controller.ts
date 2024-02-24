import { Body, Controller, Get, Post, Query, Render } from '@nestjs/common';

@Controller()
export class AppController {
  private result: any[];

  @Get()
  @Render('index')
  root(@Query('repo') repo?: string) {
    if (repo) {
      this.result = repo.split('');
      return { result: this.result, repo };
    }

    return { repo };
  }
}
