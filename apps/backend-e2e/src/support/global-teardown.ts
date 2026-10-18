import { killPort } from '@nx/node/utils';
/* eslint-disable */

module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  // Only kill port if explicitly requested by CI environment
  if (process.env.KILL_PORT_ON_TEARDOWN === 'true') {
    const port = process.env.PORT ? Number(process.env.PORT) : 3000;
    await killPort(port);
  }
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
