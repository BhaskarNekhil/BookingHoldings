const dotenvOptions = process.env.DOTENV_CONFIG_PATH
  ? { path: process.env.DOTENV_CONFIG_PATH }
  : {};
require("dotenv").config(dotenvOptions);
const app = require("./app");

const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
