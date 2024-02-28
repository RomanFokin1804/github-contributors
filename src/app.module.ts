import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { GithubService } from './github/github.service';
import { ConfigModule } from '@nestjs/config';
import config from './config/config';

@Module({
  imports: [ConfigModule.forRoot({ load: [config], isGlobal: true })],
  controllers: [AppController],
  providers: [GithubService],
})
export class AppModule {}
