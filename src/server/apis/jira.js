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
          if (!body || res.statusCode === 204) {
            resolve(true);
            return;
          }
          let responseFunction = reject;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            responseFunction = resolve;
          }
          try {
            responseFunction(JSON.parse(body));
          } catch (err) {
            responseFunction(body);
          }
        }
      });
    } catch (error) {
      console.error('fatal error', error);
      reject(error);
    }
  });
}
