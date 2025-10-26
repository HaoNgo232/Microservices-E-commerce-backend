import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from '@user-app/users/users.service';
import { EVENTS } from '@shared/events';
import { UpdateUserDto, ListUsersDto } from '@shared/dto/user.dto';
import { ListUsersResponse, UserResponse } from '@shared/main';

export interface IUsersController {
  findById(id: string): Promise<UserResponse>;
  findByEmail(email: string): Promise<UserResponse>;
  update(payload: { id: string; dto: UpdateUserDto }): Promise<UserResponse>;
  deactivate(id: string): Promise<{ message: string }>;
  list(query: ListUsersDto): Promise<ListUsersResponse>;
}

@Controller()
export class UsersController implements IUsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  findById(@Payload() id: string): Promise<UserResponse> {
    return this.usersService.findById(id);
  }

  @MessagePattern(EVENTS.USER.FIND_BY_EMAIL)
  findByEmail(@Payload() email: string): Promise<UserResponse> {
    return this.usersService.findByEmail(email);
  }

  @MessagePattern(EVENTS.USER.UPDATE)
  update(@Payload() payload: { id: string; dto: UpdateUserDto }): Promise<UserResponse> {
    return this.usersService.update(payload.id, payload.dto);
  }

  @MessagePattern(EVENTS.USER.DEACTIVATE)
  deactivate(@Payload() id: string): Promise<{
    message: string;
  }> {
    return this.usersService.deactivate(id);
  }

  @MessagePattern(EVENTS.USER.LIST)
  list(@Payload() query: ListUsersDto): Promise<ListUsersResponse> {
    return this.usersService.list(query);
  }
}
