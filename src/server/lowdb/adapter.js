// @flow
import path from 'path';
import lowdb from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';

export default function lowdbLoader(
  dbName: string,
  defaults: ?{},
  options?: *
) {
  const adapter = new FileSync(
    path.join(__dirname, `../lowdb/${dbName}.json`),
    options
  );
  const dbInstance = lowdb(adapter);
  if (defaults) dbInstance.defaults(defaults).write();
  return dbInstance;
}
