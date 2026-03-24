import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { PrismaService } from './prisma.service';
import { OpenAIHelper } from './openai-helper.service';

@Module({
  controllers: [AIController],
  providers: [AIService, PrismaService, OpenAIHelper],
  exports: [AIService],
})
export class AIModule {}
