import http from 'http';
import app from '../server/app.js';
import { setupSocketServer } from '../server/socketServer.js';
import { io as ClientIO } from 'socket.io-client';

async function runVerification() {
  console.log('🧪 Starting Group Chat & Auth Fixes Verification...');

  // Start temporary test server on port 5055
  const TEST_PORT = 5055;
  const server = http.createServer(app);
  setupSocketServer(server);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test server running on http://localhost:${TEST_PORT}`);
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  try {
    // 1. Test registration of existing email
    console.log('\n--- Test 1: Registering with existing email returns EMAIL_EXISTS ---');
    const existingRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Alice Duplicate',
        email: 'alice.walker@company.io',
        password: 'password123',
      }),
    });
    const existingData = await existingRes.json();
    console.log('Response status:', existingRes.status, 'Code:', existingData.code, 'Error:', existingData.error);
    if (existingRes.status !== 400 || existingData.code !== 'EMAIL_EXISTS') {
      throw new Error(`Expected status 400 and EMAIL_EXISTS, got ${existingRes.status} and ${existingData.code}`);
    }
    console.log('✓ Successfully detected existing email with EMAIL_EXISTS code!');

    // 2. Test login with non-existent user
    console.log('\n--- Test 2: Login with unregistered email returns USER_NOT_FOUND ---');
    const unknownRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent_user_9999@test.com',
        password: 'password123',
      }),
    });
    const unknownData = await unknownRes.json();
    console.log('Response status:', unknownRes.status, 'Code:', unknownData.code, 'Error:', unknownData.error);
    if (unknownRes.status !== 401 || unknownData.code !== 'USER_NOT_FOUND') {
      throw new Error(`Expected status 401 and USER_NOT_FOUND, got ${unknownRes.status} and ${unknownData.code}`);
    }
    console.log('✓ Successfully detected non-existent user with USER_NOT_FOUND code!');

    // 3. Register two new users with timestamp to test group chat
    const ts = Date.now();
    const user1Email = `tester_alpha_${ts}@aerodrop.test`;
    const user2Email = `tester_beta_${ts}@aerodrop.test`;

    console.log('\n--- Test 3: Registering two brand-new users ---');
    const reg1Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Tester Alpha',
        email: user1Email,
        password: 'password123',
      }),
    });
    const reg1Data = await reg1Res.json();
    console.log('User 1 registered:', reg1Data.user?.displayName, reg1Data.user?.id);

    const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Tester Beta',
        email: user2Email,
        password: 'password123',
      }),
    });
    const reg2Data = await reg2Res.json();
    console.log('User 2 registered:', reg2Data.user?.displayName, reg2Data.user?.id);

    const user1Token = reg1Data.token;
    const user2Token = reg2Data.token;
    const user1Id = reg1Data.user.id;
    const user2Id = reg2Data.user.id;

    // 4. Connect both users to WebSockets BEFORE creating the group room
    console.log('\n--- Test 4: Connecting both users to WebSockets ---');
    const socket1 = ClientIO(BASE_URL, {
      auth: { token: user1Token },
      transports: ['websocket'],
    });
    const socket2 = ClientIO(BASE_URL, {
      auth: { token: user2Token },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => socket1.on('connect', res)),
      new Promise((res) => socket2.on('connect', res)),
    ]);
    console.log('✓ Both sockets connected!');

    // Setup listener for User 2 to receive room_created event
    const user2RoomCreatedPromise = new Promise((resolve) => {
      socket2.on('room_created', (room) => {
        resolve(room);
      });
    });

    // Setup listeners for new messages
    const socket1NewMessagePromise = new Promise((resolve) => {
      socket1.on('new_message', (msg) => {
        resolve(msg);
      });
    });

    const socket2NewMessagePromise = new Promise((resolve) => {
      socket2.on('new_message', (msg) => {
        resolve(msg);
      });
    });

    // 5. User 1 creates group chat with User 2 via REST API
    console.log('\n--- Test 5: User 1 creates group chat "Alpha & Beta Squad" ---');
    const groupRes = await fetch(`${BASE_URL}/api/chat/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        type: 'group',
        name: 'Alpha & Beta Squad',
        memberIds: [user2Id],
      }),
    });
    const groupData = await groupRes.json();
    const groupRoom = groupData.room;
    console.log('Group room created with ID:', groupRoom.id);

    // Verify User 2 received room_created notification
    const receivedRoomByUser2 = await Promise.race([
      user2RoomCreatedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for room_created on User 2')), 4000)),
    ]);
    console.log('✓ User 2 received room_created socket event for:', receivedRoomByUser2.name);

    // 6. User 1 sends message to group chat via WebSocket
    console.log('\n--- Test 6: User 1 sends message in group chat ---');
    const sendAck = await new Promise((resolve, reject) => {
      socket1.emit(
        'send_message',
        {
          roomId: groupRoom.id,
          text: 'Hello from User 1 to Group Chat!',
        },
        (resp) => {
          if (resp?.error) reject(new Error(resp.error));
          else resolve(resp);
        }
      );
    });
    console.log('✓ User 1 send_message callback success:', sendAck.success, 'Message ID:', sendAck.message?.id);

    // Verify User 1 receives new_message
    const msgForUser1 = await Promise.race([
      socket1NewMessagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for new_message on User 1')), 4000)),
    ]);
    console.log('✓ User 1 (Sender) received new_message:', msgForUser1.text);

    // Verify User 2 receives new_message
    const msgForUser2 = await Promise.race([
      socket2NewMessagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for new_message on User 2')), 4000)),
    ]);
    console.log('✓ User 2 (Recipient) received new_message:', msgForUser2.text);

    // 7. Verify messages REST endpoint returns the message for both users
    console.log('\n--- Test 7: Fetching room messages via REST API ---');
    const msgListRes1 = await fetch(`${BASE_URL}/api/chat/rooms/${groupRoom.id}/messages`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const msgListData1 = await msgListRes1.json();
    console.log(`User 1 retrieved ${msgListData1.messages?.length} messages via GET /messages`);

    const msgListRes2 = await fetch(`${BASE_URL}/api/chat/rooms/${groupRoom.id}/messages`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    const msgListData2 = await msgListRes2.json();
    console.log(`User 2 retrieved ${msgListData2.messages?.length} messages via GET /messages`);

    if (msgListData1.messages.length === 0 || msgListData2.messages.length === 0) {
      throw new Error('Messages list was empty when fetched by group members!');
    }
    console.log('✓ Messages are visible to both users via REST API!');

    // 8. User 2 sends reply
    console.log('\n--- Test 8: User 2 sends reply in group chat ---');
    const replyPromise = new Promise((resolve) => {
      socket1.on('new_message', (msg) => {
        if (msg.senderId === user2Id) resolve(msg);
      });
    });

    socket2.emit('send_message', {
      roomId: groupRoom.id,
      text: 'Got your message, User 1! Real-time group chat is working perfectly.',
    });

    const replyMsg = await Promise.race([
      replyPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for reply')), 4000)),
    ]);
    console.log('✓ User 1 received reply from User 2:', replyMsg.text);

    socket1.disconnect();
    socket2.disconnect();

    console.log('\n============================================');
    console.log('🎉 ALL GROUP CHAT & AUTH TESTS PASSED 100%!');
    console.log('============================================\n');
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
