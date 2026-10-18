import type { RequestHandler } from 'express';
import type { DeleteAccountInput } from '@ru-lost-found/shared';
import { actorOf } from '../../core/http/auth';
import type { AccountService } from './account.service';

export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  /** A JSON file download, named after the day it was made. */
  exportData: RequestHandler = async (req, res) => {
    const data = await this.accounts.exportData(actorOf(req));
    res.attachment(`lost-and-found-data-${data.exportedAt.slice(0, 10)}.json`).json(data);
  };

  /** The web app signs out afterwards, which clears the refresh cookie. */
  deleteAccount: RequestHandler = async (req, res) => {
    await this.accounts.deleteAccount(actorOf(req), req.body as DeleteAccountInput, {
      ip: req.ip ?? null,
    });
    res.status(204).end();
  };
}
