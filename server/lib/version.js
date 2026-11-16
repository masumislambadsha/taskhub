/**
 * Build identifier: GIT_SHA, else RENDER_GIT_COMMIT (set by Render), else
 * "dev". Shortened to 7 characters, like the web app's getVersion().
 */
function getVersion(env = process.env) {
  const sha = env.GIT_SHA || env.RENDER_GIT_COMMIT;
  return sha ? sha.slice(0, 7) : "dev";
}

module.exports = { getVersion };
