/**
 * AR Microservice Controller
 *
 * Xử lý NATS messages liên quan đến AR snapshots
 * - EVENTS.AR.SNAPSHOT_CREATE: Tạo AR snapshot mới
 * - EVENTS.AR.SNAPSHOT_LIST: Lấy danh sách AR snapshots với pagination
 *
 * Ghi chú: Controller chỉ route message đến service, không có business logic
 */

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ArService } from '@ar-app/ar/ar.service';
import { EVENTS } from '@shared/events';
import { ARSnapshotCreateDto, ARSnapshotListDto } from '@shared/dto/ar.dto';
import { ARSnapshotCreateResponse, PaginatedARSnapshotsResponse } from '@shared/types';

@Controller()
export class ArController {
  /**
   * Inject ArService để xử lý business logic
   */
  constructor(private readonly arService: ArService) {}

  /**
   * NATS Handler: Tạo AR snapshot
   *
   * Pattern: EVENTS.AR.SNAPSHOT_CREATE (ar.snapshotCreate)
   * @param dto - { userId, productId, imageUrl, metadata }
   * @returns - { id, imageUrl, createdAt }
   */
  @MessagePattern(EVENTS.AR.SNAPSHOT_CREATE)
  snapshotCreate(@Payload() dto: ARSnapshotCreateDto): Promise<ARSnapshotCreateResponse> {
    return this.arService.snapshotCreate(dto);
  }

  /**
   * NATS Handler: Lấy danh sách AR snapshots
   *
   * Pattern: EVENTS.AR.SNAPSHOT_LIST (ar.snapshotList)
   * @param dto - { userId?, productId?, page?, pageSize? }
   * @returns - { snapshots[], total, page, pageSize }
   */
  @MessagePattern(EVENTS.AR.SNAPSHOT_LIST)
  snapshotList(@Payload() dto: ARSnapshotListDto): Promise<PaginatedARSnapshotsResponse> {
    return this.arService.snapshotList(dto);
  }
}
