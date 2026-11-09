import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportService } from './import.service';

@Module({
  imports: [PrismaModule],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
