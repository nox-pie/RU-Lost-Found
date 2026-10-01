import type { RequestHandler } from 'express';
import type { UpdateProfileInput } from '@ru-lost-found/shared';
import { authOf } from '../../core/http/auth';
import { toMeDto } from './user.mapper';
import type { UserService } from './user.service';

export class UserController {
  constructor(private readonly users: UserService) {}

  getMe: RequestHandler = async (req, res) => {
    const user = await this.users.getById(authOf(req).userId);
    res.json(toMeDto(user));
  };

  updateMe: RequestHandler = async (req, res) => {
    const user = await this.users.updateProfile(authOf(req).userId, req.body as UpdateProfileInput);
    res.json(toMeDto(user));
  };

  changeAvatar: RequestHandler = async (req, res) => {
    const user = await this.users.changeAvatar(authOf(req).userId, req.images?.[0]);
    res.json(toMeDto(user));
  };

  removeAvatar: RequestHandler = async (req, res) => {
    const user = await this.users.removeAvatar(authOf(req).userId);
    res.json(toMeDto(user));
  };
}
