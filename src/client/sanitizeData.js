// @flow
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';

export default function sanitizeData(data: any): any {
  if (isArray(data)) {
    return data.map(sanitizeData);
  }
  if (!isObject(data)) {
    return data;
  }
  const result = {};
  Object.keys(data).forEach((key) => {
    if (key !== '__typename' && key !== '__meta') {
      result[key] = sanitizeData(data[key]);
    }
  });
  return result;
}
