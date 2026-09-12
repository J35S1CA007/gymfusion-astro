// @ts-nocheck

export const ok = ({ body, headers = {} }) => Response.json(body, { status: 200, headers });
export const badRequest = ({ body, headers = {} }) => Response.json(body, { status: 400, headers });
export const serverError = ({ body, headers = {} }) => Response.json(body, { status: 500, headers });
