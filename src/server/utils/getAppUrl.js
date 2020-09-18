// @flow
import os from 'os';

export default function getAppUrl(): string {
  // AC_LOCAL_BASE_URL comes from atlassian-connect-express startup
  const url =
    process.env.APP_URL ||
    process.env.AC_LOCAL_BASE_URL ||
    'http://' + os.hostname() + ':' + (process.env.PORT || 80);
  return url.replace(/\/+$/gi, '');
}
