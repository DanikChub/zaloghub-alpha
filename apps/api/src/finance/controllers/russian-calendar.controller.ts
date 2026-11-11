import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { validation } from '../../common/validation-pipes.js';
import { RussianCalendarService } from '../calendar/russian-calendar.service.js';
import { CalendarImportDto } from '../dto/financial-instruction.dto.js';

@Controller('finance/calendars/ru')
@UseGuards(JwtAuthGuard)
export class RussianCalendarController {
  constructor(private readonly service: RussianCalendarService) {}
  @Get() list() {
    return this.service.list();
  }
  @Post('import') importYear(@Body(validation) dto: CalendarImportDto) {
    return this.service.importYear(dto.year, dto.refresh);
  }
}
