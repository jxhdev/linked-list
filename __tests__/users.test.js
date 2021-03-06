process.env.NODE_ENV = 'test';
const db = require('../db');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../index');

const auth = {};

//Create tables
beforeAll(async () => {
  await db.query(
    `CREATE TABLE companies (id SERIAL PRIMARY KEY, handle TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, logo TEXT, email TEXT NOT NULL UNIQUE);`
  );

  await db.query(
    `CREATE TABLE jobs (id SERIAL PRIMARY KEY, title TEXT, salary INTEGER, equity REAL, company TEXT REFERENCES companies (handle) ON DELETE CASCADE);`
  );

  await db.query(
    `CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, photo TEXT, current_company TEXT REFERENCES companies (handle) ON DELETE CASCADE);`
  );

  await db.query(
    `CREATE TABLE applications (id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs (id) ON DELETE CASCADE, username TEXT REFERENCES users (username) ON DELETE CASCADE);`
  );
});

beforeEach(async () => {
  // login a user, get a token, store the user ID and token
  const hashedPassword = await bcrypt.hash('secret', 1);
  await db.query(
    "INSERT INTO users (username, password, first_name, last_name, email) VALUES ('test', $1, 'foo', 'bar', 'email@example.com')",
    [hashedPassword]
  );
  const response = await request(app)
    .post('/user-auth')
    .send({
      username: 'test',
      password: 'secret'
    });
  auth.user_token = response.body.token;
  auth.current_username = jwt.decode(auth.user_token).username;
});

describe('GET /users', () => {
  test('gets a list of 1 user', async () => {
    const response = await request(app)
      .get('/users')
      .set('authorization', auth.user_token);
    expect(response.body).toHaveLength(1);
  });

  test('gets a list of 2 users', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO users (username, password, first_name, last_name, email) VALUES ('test2', $1, 'foo', 'bar', 'email@example.com')",
      [hashedPassword]
    );

    const response = await request(app)
      .get('/users')
      .set('authorization', auth.user_token);
    expect(response.body).toHaveLength(2);
  });
});

describe('POST /users', () => {
  test('add a user', async () => {
    const response = await request(app)
      .post('/users')
      .send({
        username: 'test_user',
        password: 'password',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@user.com'
      });
    expect(Object.keys(response.body)).toHaveLength(7);
    expect(response.body.username).toEqual('test_user');
    expect(response.body.password).toBeUndefined();
  });
  test('throw an error if company does not exist', async () => {
    const response = await request(app)
      .post('/users')
      .send({
        username: 'test_user',
        password: 'password',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@user.com',
        current_company: 'google'
      });
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual('Company does not exist.');
  });
  test('attempting to add a duplicate username throws a 409 error', async () => {
    const firstResponse = await request(app)
      .post('/users')
      .send({
        username: 'test_user',
        password: 'password',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@user.com'
      });
    const secondResponse = await request(app)
      .post('/users')
      .send({
        username: 'test_user',
        password: 'password',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@user.com'
      });
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.message).toEqual('Username already exists.');
  });
});

describe('GET /users/:username', () => {
  test('successfully gets a user by username', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO users (username, password, first_name, last_name, email) VALUES ('test2', $1, 'foo', 'bar', 'email@example.com')",
      [hashedPassword]
    );
    const response = await request(app)
      .get('/users/test2')
      .set('authorization', auth.user_token);
    expect(response.body.username).toEqual('test2');
    expect(Object.keys(response.body)).toHaveLength(8);
  });
});

describe('PATCH /users/:username', () => {
  test('can selectively patch correct user', async () => {
    const response = await request(app)
      .patch(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token)
      .send({
        first_name: 'Tyler',
        password: 'hi'
      });
    expect(response.body.first_name).toEqual('Tyler');
    expect(Object.keys(response.body)).toHaveLength(7);
  });

  test('cannot patch with a company that does not exist', async () => {
    const response = await request(app)
      .patch(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token)
      .send({
        current_company: 'google'
      });
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual('Company does not exist.');
  });

  test('cannot patch another user', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO users (username, password, first_name, last_name, email) VALUES ('test2', $1, 'foo', 'bar', 'email@example.com')",
      [hashedPassword]
    );
    const response = await request(app)
      .patch(`/users/test2`)
      .set('authorization', auth.user_token)
      .send({
        first_name: 'Tyler'
      });
    expect(response.status).toBe(403);
  });
});

describe('DELETE /users/:id/', () => {
  test('successfully deletes own user', async () => {
    const response = await request(app)
      .delete(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    expect(response.status).toBe(200);
    expect(response.body.username).toBe(auth.current_username);
  });

  test('cannot delete other user', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO users (username, password, first_name, last_name, email) VALUES ('test2', $1, 'foo', 'bar', 'email@example.com')",
      [hashedPassword]
    );
    const response = await request(app)
      .delete(`/users/$test2`)
      .set('authorization', auth.user_token);
    expect(response.status).toBe(403);
  });
});

afterEach(async () => {
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM companies');
  await db.query('DELETE FROM jobs');
});

afterAll(async () => {
  console.log('after all!');

  await db.query('DROP TABLE IF EXISTS applications');
  await db.query('DROP TABLE IF EXISTS jobs');
  await db.query('DROP TABLE IF EXISTS users');
  await db.query('DROP TABLE IF EXISTS companies');
  db.end();
});
