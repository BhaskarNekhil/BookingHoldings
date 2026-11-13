// Sequential JSON-driven API case runner.
// Each JSON case needs an `execution` object; see the runner notes below.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const envPath = path.resolve(__dirname, "../.env.test");
const caseFile = path.join(__dirname, "api-test-cases.json");
const reportFile = path.join(__dirname, "api-test-report.json");

if (!fs.existsSync(envPath)) {
  test("API matrix needs backend/.env.test", { skip: "Create .env.test for BookingHoldings_test" }, () => {});
} else {
  require("dotenv").config({ path: envPath, override: true });

  test("run API matrix cases from JSON in order", async (t) => {
    assert.equal(
      process.env.DATABASE_NAME,
      "BookingHoldings_test",
      "Refusing to run against a database other than BookingHoldings_test",
    );

    const matrix = JSON.parse(fs.readFileSync(caseFile, "utf8"));
    assert.ok(Array.isArray(matrix.cases), "JSON must contain a cases array");
    assert.equal(matrix.cases.length, matrix.caseCount, "caseCount does not match cases.length");

    const app = require("../src/app");
    const pool = require("../src/config/db");
    let server;
    const tokens = new Map();
    const results = [];

    try {
      // Fail before starting HTTP tests if the database is unavailable or unseeded.
      const db = await pool.query("SELECT COUNT(*)::int AS count FROM users");
      assert.ok(db.rows[0].count > 0, "Seed BookingHoldings_test before running the matrix");

      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });
      const baseUrl = `http://127.0.0.1:${server.address().port}`;

      async function login(travellerId) {
        if (tokens.has(travellerId)) return tokens.get(travellerId);
        const response = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `${travellerId.toLowerCase()}@seed.local`,
            password: "Password@123",
          }),
        });
        const payload = await readPayload(response);
        assert.equal(response.status, 200, `Could not authenticate ${travellerId}: ${JSON.stringify(payload)}`);
        tokens.set(travellerId, payload.token);
        return payload.token;
      }

      for (const item of matrix.cases) {
        try {
          if (!item.execution) {
            const result = {
              id: item.id,
              outcome: "BLOCKED",
              reason: "JSON case has no execution request/assertions yet",
            };
            results.push(result);
            console.log(`BLOCKED ${item.id}: ${result.reason}`);
            continue;
          }

          const spec = item.execution;
          assert.ok(spec.method && spec.path, "execution.method and execution.path are required");
          const headers = { ...(spec.headers || {}) };
          if (spec.authTravellerId)
            headers.Authorization = `Bearer ${await login(spec.authTravellerId)}`;
          if (spec.body !== undefined) headers["Content-Type"] = "application/json";
          if (["POST", "PUT", "PATCH", "DELETE"].includes(spec.method.toUpperCase())) {
            headers["Idempotency-Key"] ||= `matrix-${item.id}-${process.pid}`;
          }

          const response = await fetch(`${baseUrl}${spec.path}`, {
            method: spec.method.toUpperCase(),
            headers,
            ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
          });
          const payload = await readPayload(response);
          const expectedStatus = spec.expectedStatus ?? item.expectedHttpStatus;
          assert.equal(response.status, expectedStatus,
            `Expected HTTP ${expectedStatus}; received ${response.status}: ${JSON.stringify(payload)}`);

          for (const check of spec.assertions || []) assertResponse(payload, check);
          results.push({ id: item.id, outcome: "PASS", expectedStatus, actualStatus: response.status });
          console.log(`PASS ${item.id} (${response.status})`);
        } catch (error) {
          // Keep going so the run reports all case outcomes instead of stopping at the first failure.
          if (!results.some((result) => result.id === item.id)) {
            results.push({ id: item.id, outcome: "FAIL", error: error.message });
          }
          console.log(`FAIL ${item.id}: ${error.message}`);
        }
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await pool.end();
    }

    const totals = {
      total: matrix.cases.length,
      passed: results.filter((result) => result.outcome === "PASS").length,
      failed: results.filter((result) => result.outcome === "FAIL").length,
      blocked: results.filter((result) => result.outcome === "BLOCKED").length,
      database: matrix.database,
      finishedAt: new Date().toISOString(),
      results,
    };
    fs.writeFileSync(reportFile, `${JSON.stringify(totals, null, 2)}\n`);
    console.log(`\nAPI matrix: ${totals.passed} passed, ${totals.failed} failed, ${totals.blocked} blocked (${totals.total} total).`);
    console.log(`Report: ${reportFile}`);

    assert.equal(totals.failed, 0, `${totals.failed} API matrix case(s) failed; see api-test-report.json`);
  });
}

async function readPayload(response) {
  const raw = await response.text();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function assertResponse(payload, assertion) {
  const actual = assertion.path.split(".").reduce((value, key) => value?.[key], payload);
  if (assertion.exists === true) assert.notEqual(actual, undefined, `${assertion.path} should exist`);
  else if (assertion.exists === false) assert.equal(actual, undefined, `${assertion.path} should not exist`);
  else if (Object.hasOwn(assertion, "equals")) assert.deepEqual(actual, assertion.equals, `${assertion.path} mismatch`);
  else if (Object.hasOwn(assertion, "includes")) {
    assert.ok(Array.isArray(actual) && actual.includes(assertion.includes),
      `${assertion.path} should include ${JSON.stringify(assertion.includes)}`);
  } else {
    assert.fail(`Unsupported assertion for ${assertion.path}`);
  }
}
