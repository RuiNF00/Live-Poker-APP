// The share API is public (app, web page and anyone with a link), so CORS is open.
export const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-edit-token',
};
