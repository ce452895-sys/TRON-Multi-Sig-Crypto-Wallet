const request = require('supertest');
const { expect } = require('chai');
const app = require('../src/app');

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ status: 'ok' });
  });
});

describe('Auth guard', () => {
  it('rejects wallet requests without a bearer token', async () => {
    const res = await request(app).get('/wallets/TAbc123');
    expect(res.status).to.equal(401);
  });
});
