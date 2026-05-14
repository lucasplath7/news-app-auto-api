import type { NextFunction, Request, Response } from "express";

export const asyncHandler = <
  TRequest extends Request = Request,
  TResponse extends Response = Response
>(
  fn: (req: TRequest, res: TResponse, next: NextFunction) => Promise<unknown>
) => {
  return (req: TRequest, res: TResponse, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

