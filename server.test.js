const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

test('adding a post preserves existing posts in the list and on disk', async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'vote-board-test-'));
  const projectDirectory = path.join(temporaryDirectory, 'project');
  const dataDirectory = path.join(temporaryDirectory, 'persistent-data');
  const existingPost = {
    id: 'existing-post',
    text: '기존 게시글',
    createdAt: 1,
    reports: [],
    deletedAt: null
  };
  let serverProcess;

  try {
    await fs.mkdir(projectDirectory, { recursive: true });
    await fs.mkdir(dataDirectory, { recursive: true });
    await Promise.all(['server.js', 'moderation.js'].map(file =>
      fs.copyFile(path.join(__dirname, file), path.join(projectDirectory, file))
    ));
    await fs.writeFile(
      path.join(dataDirectory, 'board.json'),
      JSON.stringify({ posts: [existingPost] })
    );

    const portServer = net.createServer();
    await new Promise((resolve, reject) => {
      portServer.once('error', reject);
      portServer.listen(0, '127.0.0.1', resolve);
    });
    const { port } = portServer.address();
    await new Promise((resolve, reject) => {
      portServer.close(error => error ? reject(error) : resolve());
    });

    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: projectDirectory,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        VOTE_DATA_DIR: dataDirectory
      },
      stdio: 'ignore'
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    let response;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        response = await fetch(`${baseUrl}/api/board/posts`);
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    assert.ok(response, 'server should start');
    assert.equal(response.status, 200);

    const createdResponse = await fetch(`${baseUrl}/api/board/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '새 게시글' })
    });
    assert.equal(createdResponse.status, 201);

    const listResponse = await fetch(`${baseUrl}/api/board/posts`);
    const { posts } = await listResponse.json();
    assert.deepEqual(posts.map(post => post.text), ['새 게시글', '기존 게시글']);

    const saved = JSON.parse(await fs.readFile(path.join(dataDirectory, 'board.json'), 'utf8'));
    assert.deepEqual(saved.posts.map(post => post.text), ['기존 게시글', '새 게시글']);
    assert.equal(saved.posts[0].id, existingPost.id);

    serverProcess.kill();
    await new Promise(resolve => serverProcess.once('exit', resolve));
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: projectDirectory,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        VOTE_DATA_DIR: dataDirectory
      },
      stdio: 'ignore'
    });

    let restartedResponse;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        restartedResponse = await fetch(`${baseUrl}/api/board/posts`);
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    assert.ok(restartedResponse, 'server should restart with persisted data');
    assert.equal(restartedResponse.status, 200);
    const restartedPosts = (await restartedResponse.json()).posts;
    assert.deepEqual(restartedPosts.map(post => post.text), ['새 게시글', '기존 게시글']);
  } finally {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
      await new Promise(resolve => serverProcess.once('exit', resolve));
    }
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});
