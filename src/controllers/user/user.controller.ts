import type { Request, Response } from "express";
import { db } from "../../config/db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/appError.js";
import type { CreateUserBody } from "../../schemas/user/user.schemas.js";
import { sql } from "kysely";

export const createUserController = asyncHandler(
  async (req: Request<{}, {}, CreateUserBody>, res: Response) => {
    const { userName } = req.body;

    const existing = await db
      .selectFrom("template_app.users")
      .select(["id", "name"])
      .where("name", "=", userName)
      .executeTakeFirst();

    if (existing) {
      res.status(200).json({ userId: existing.id, userName: existing.name });
      return;
    }

    const created = await db
      .insertInto("template_app.users")
      .values({ id: sql`gen_random_uuid()`, name: userName })
      .returning(["id", "name"])
      .executeTakeFirst();

    if (!created) {
      throw new AppError(500, "Failed to create user");
    }

    res.status(201).json({ userId: created.id, userName: created.name });
  }
);
