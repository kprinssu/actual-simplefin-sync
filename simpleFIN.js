const https = require('https')

const logLevels = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

function log(level, message) {
  console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}]: ${message}`);
}

async function parseAccessKey(accessKey, isRetry = false) {
  try {
    log(logLevels.DEBUG, `Parsing access key: ${accessKey}`);
    let [scheme, rest] = accessKey.split('//');
    let [auth, baseUrl] = rest.split('@');
    let [username, password] = auth.split(':');
    baseUrl = `${scheme}//${baseUrl}`;
    return { baseUrl, username, password };
  } catch (error) {
    log(logLevels.ERROR, `Error parsing access key: ${error.message}`);

    if (!isRetry) {
      log(logLevels.INFO, 'Retrying to fetch access key');
      try {
        // Assuming getAccessKey is an async function that returns the access key
        const newAccessKey = await getAccessKey(token);
        return parseAccessKey(newAccessKey, true); // Recursive call with the new access key and retry flag set to true
      } catch (retryError) {
        log(logLevels.ERROR, `Error fetching access key on retry: ${retryError.message}`);
        throw retryError; // If retry also fails, throw the error
      }
    } else {
      throw error; // If this was already a retry, throw the original error
    }
  }
}

async function getAccessKey(base64Token) {
  try {
    log(logLevels.INFO, 'Requesting access key');
    const token = Buffer.from(base64Token, 'base64').toString();
    const options = { method: 'POST', port: 443, headers: { 'Content-Length': 0 } };
    return new Promise((resolve, reject) => {
      const req = https.request(new URL(token), options, (res) => {
        res.on('data', (d) => resolve(d.toString()));
      });
      req.on('error', (e) => {
        log(logLevels.ERROR, `Request error: ${e.message}`);
        reject(e);
      });
      req.end();
    });
  } catch (error) {
    log(logLevels.ERROR, `Error in getAccessKey: ${error.message}`);
    throw error;
  }
}

async function getTransactions(accessKey, startDate, endDate) {
  try {
    log(logLevels.INFO, 'Retrieving transactions');
      const now = new Date();
      startDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 1);
      console.log(`${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`);
      return await getAccounts(accessKey, startDate, endDate);
  } catch (error) {
    log(logLevels.ERROR, `Error getting transactions: ${error.message}`);
    throw error;
  }
}


function normalizeDate (date) {
  return (date.valueOf() - date.getTimezoneOffset() * 60 * 1000) / 1000
}

async function getAccounts(accessKey, startDate, endDate) {
  try {
    log(logLevels.INFO, 'Fetching accounts');
    const sfin = parseAccessKey(accessKey)
    const options = {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sfin.username}:${sfin.password}`).toString('base64')}`
      }
    }
    const params = []
    let queryString = ''
    if (startDate) {
      params.push(`start-date=${normalizeDate(startDate)}`)
    }
    if (endDate) {
      params.push(`end-date=${normalizeDate(endDate)}`)
    }
    if (params.length > 0) {
      queryString += '?' + params.join('&')
    }
    return new Promise((resolve, reject) => {
      const req = https.request(new URL(`${sfin.baseUrl}/accounts${queryString}`), options, (res) => {
        let data = ''
      res.on('data', (d) => {
          data += d
        })
        res.on('end', () => {
          resolve(JSON.parse(data))
        })
      })
      req.on('error', (e) => {
        reject(e)
      })
      req.end()
    })
  }
  catch (error) {
    log(logLevels.ERROR, `Error fetching accounts: ${error.message}`);
    throw error;
  }
}

module.exports = { parseAccessKey, getAccessKey, getAccounts, getTransactions }
