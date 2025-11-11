import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GlassesService } from '@product-app/glasses/glasses.service';
import { EVENTS } from '@shared/events';
import {
  GlassesModelIdDto,
} from '@shared/dto/glasses.dto';
import { GlassesModelResponse, GlassesModelDownloadResponse } from '@shared/types/glasses.types';

export interface IGlassesController {
  list(): Promise<GlassesModelResponse[]>;
  getById(dto: GlassesModelIdDto): Promise<GlassesModelResponse>;
  downloadModel(dto: GlassesModelIdDto): Promise<GlassesModelDownloadResponse>;
}

@Controller()
export class GlassesController implements IGlassesController {
  constructor(private readonly glassesService: GlassesService) {}

  @MessagePattern(EVENTS.GLASSES.LIST_MODELS)
  list(): Promise<GlassesModelResponse[]> {
    return this.glassesService.list();
  }

  @MessagePattern(EVENTS.GLASSES.GET_MODEL)
  getById(@Payload() dto: GlassesModelIdDto): Promise<GlassesModelResponse> {
    return this.glassesService.getById(dto);
  }

  @MessagePattern(EVENTS.GLASSES.DOWNLOAD_MODEL)
  downloadModel(@Payload() dto: GlassesModelIdDto): Promise<GlassesModelDownloadResponse> {
    return this.glassesService.downloadModel(dto);
  }
}

