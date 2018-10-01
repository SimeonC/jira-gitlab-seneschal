export function jiraRequest(api, method, url, body) {
  const args = {
    uri: `/rest/api/3/${url}`.replace(/\/+/gi, '/')
  };
  if (body) {
    try {
      args.body = body;
      args.json = true;
    } catch (e) {
      // probably not a body ;)
    }
  }
  return new Promise((resolve, reject) => {
    try {
      api[method](args, (err, res, body) => {
        if (err) reject(err);
        else {
          if (!body || res.status === 204) {
            resolve(true);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            resolve(body);
          }
        }
      });
    } catch (error) {
      console.error('fatal error', error);
      reject(error);
    }
  });
}
