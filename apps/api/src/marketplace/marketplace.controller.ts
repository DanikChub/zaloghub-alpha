import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';
import { CollectorGuard } from './collector.guard.js';
import { MarketplaceService, type Upload } from './marketplace.service.js';
import { markInput, rawPublication } from './marketplace.validation.js';
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}
  @Get('dictionaries') dictionaries() {
    return this.service.dictionaries();
  }
  @Get('offers') list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(req.user.id, query);
  }
  @Get('offers/:id') one(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.one(req.user.id, id);
  }
  @Patch('offers/:id/mark') mark(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.mark(req.user.id, id, markInput(body));
  }
  @Get('photos/:id') async photo(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const photo = await this.service.photo(id);
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(Buffer.from(photo.content));
  }
}
@Controller('internal/marketplace')
@UseGuards(CollectorGuard)
export class MarketplaceCollectorController {
  constructor(private readonly service: MarketplaceService) {}
  @Get('sources') sources() {
    return this.service.sources();
  }
  @Post('messages')
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10,
        fields: 1,
        fieldSize: 256 * 1024,
      },
    }),
  )
  ingest(@Body('raw') raw: string, @UploadedFiles() files: Upload[]) {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Некорректный JSON');
    }
    return this.service.ingest(rawPublication(value), files ?? []);
  }
}
