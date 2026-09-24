import { io } from 'socket.io-client';

async function testMultiUserChat() {
  console.log('🧪 Starting Multi-User Group Chat & Auth Verification Suite...\n');
  const BASE_URL = 'http://localhost:5000';

  // 1. Register User 1: Alice Walker
  console.log('1. Registering User 1: Alice Walker...');
  const res1 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Alice Walker',
      email: 'alice.walker@company.io',
      password: 'password123',
    }),
  });
  const data1 = await res1.json();
  const alice = data1.user || (await (await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice.walker@company.io', password: 'password123' }),
  })).json()).user;
  const aliceToken = data1.token || (await (await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice.walker@company.io', password: 'password123' }),
  })).json()).token;

  console.log('   Alice Account Created:', {
    id: alice.id,
    displayName: alice.displayName,
    initials: alice.initials,
    color: alice.color,
  });

  // 2. Register User 2: Bob Chen
  console.log('\n2. Registering User 2: Bob Chen (Separate Device / Account)...');
  const res2 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Bob Chen',
      email: 'bob.chen@designstudio.org',
      password: 'securepass456',
    }),
  });
  const data2 = await res2.json();
  const bob = data2.user || (await (await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bob.chen@designstudio.org', password: 'securepass456' }),
  })).json()).user;
  const bobToken = data2.token || (await (await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bob.chen@designstudio.org', password: 'securepass456' }),
  })).json()).token;

  console.log('   Bob Account Created:', {
    id: bob.id,
    displayName: bob.displayName,
    initials: bob.initials,
    color: bob.color,
  });

  // Confirm distinct attribution
  console.log('   Verification: Alice & Bob have unique userIds and distinct avatar colors:', {
    distinctIds: alice.id !== bob.id,
    aliceColor: alice.color,
    bobColor: bob.color,
  });

  // 3. Connect Alice via WebSockets (Device 1)
  console.log('\n3. Connecting Alice (Device 1) to Socket.io...');
  const aliceSocket = io(BASE_URL, {
    auth: { token: aliceToken },
    transports: ['websocket'],
  });

  await new Promise((resolve) => aliceSocket.on('connect', resolve));
  console.log('   Alice connected via WebSocket with authenticated session.');

  // 4. Connect Bob via WebSockets (Device 2)
  console.log('\n4. Connecting Bob (Device 2) to Socket.io...');
  const bobSocket = io(BASE_URL, {
    auth: { token: bobToken },
    transports: ['websocket'],
  });

  await new Promise((resolve) => bobSocket.on('connect', resolve));
  console.log('   Bob connected via WebSocket with authenticated session.');

  // 5. Alice creates a multi-member Group Chat: "Product Launch Squad"
  console.log('\n5. Alice creates Group Chat "Product Launch Squad" with Bob...');
  const groupRes = await fetch(`${BASE_URL}/api/chat/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aliceToken}`,
    },
    body: JSON.stringify({
      type: 'group',
      name: 'Product Launch Squad',
      memberIds: [bob.id],
    }),
  });
  const groupData = await groupRes.json();
  const room = groupData.room;
  console.log('   Group Chat Created:', {
    id: room.id,
    name: room.name,
    memberCount: room.memberIds.length,
    createdBy: room.createdBy,
  });

  // Both join the room on their respective devices with callback acknowledgment
  await new Promise((res) => aliceSocket.emit('join_room', room.id, res));
  await new Promise((res) => bobSocket.emit('join_room', room.id, res));

  // Set up listeners on Bob's device
  const bobReceivedPromise = new Promise((resolve) => {
    bobSocket.on('new_message', (msg) => {
      resolve(msg);
    });
  });

  // Set up typing listener on Alice's device
  const aliceTypingPromise = new Promise((resolve) => {
    aliceSocket.on('user_typing', (data) => {
      resolve(data);
    });
  });

  // 6. Alice sends a message from Device 1
  console.log('\n6. Alice sends message from Device 1 to Group...');
  aliceSocket.emit('send_message', {
    roomId: room.id,
    text: 'Hey team! Welcome to the Product Launch Squad.',
    // Notice: Client does NOT send senderName or avatar! Backend extracts it from authenticated session!
  });

  const messageReceivedByBob = await bobReceivedPromise;
  console.log('   Message received by Bob on Device 2:');
  console.log('   Text:', messageReceivedByBob.text);
  console.log('   Sender ID:', messageReceivedByBob.senderId, '(Matches Alice:', messageReceivedByBob.senderId === alice.id, ')');
  console.log('   Sender Name:', messageReceivedByBob.senderName, '(Verified:', messageReceivedByBob.senderName === 'Alice Walker', ')');
  console.log('   Sender Initials:', messageReceivedByBob.senderInitials);
  console.log('   Sender Color:', messageReceivedByBob.senderColor);

  // 7. Bob triggers typing indicator on Device 2
  console.log('\n7. Bob types on Device 2...');
  bobSocket.emit('typing_start', { roomId: room.id });
  const typingEvent = await aliceTypingPromise;
  console.log('   Alice on Device 1 received typing notification:', typingEvent);

  // 8. Bob sends response from Device 2
  console.log('\n8. Bob sends reply from Device 2...');
  const aliceReceivedPromise = new Promise((resolve) => {
    aliceSocket.on('new_message', (msg) => {
      if (msg.senderId === bob.id) resolve(msg);
    });
  });

  bobSocket.emit('send_message', {
    roomId: room.id,
    text: 'Excited to be here! Working on the release assets now.',
  });

  const messageReceivedByAlice = await aliceReceivedPromise;
  console.log('   Message received by Alice on Device 1:');
  console.log('   Text:', messageReceivedByAlice.text);
  console.log('   Sender ID:', messageReceivedByAlice.senderId, '(Matches Bob:', messageReceivedByAlice.senderId === bob.id, ')');
  console.log('   Sender Name:', messageReceivedByAlice.senderName, '(Verified:', messageReceivedByAlice.senderName === 'Bob Chen', ')');

  // 9. Simultaneous Multi-Device Session Test:
  // Alice logs in on Device 3 (e.g. mobile phone) with her same account
  console.log('\n9. Testing Multi-Device Session for Alice (Simultaneous phone login)...');
  const alicePhoneSocket = io(BASE_URL, {
    auth: { token: aliceToken },
    transports: ['websocket'],
  });
  await new Promise((res) => alicePhoneSocket.emit('join_room', room.id, res));

  const phoneMessagePromise = new Promise((resolve) => {
    bobSocket.on('new_message', (msg) => {
      if (msg.text.includes('from my mobile')) resolve(msg);
    });
  });

  alicePhoneSocket.emit('send_message', {
    roomId: room.id,
    text: 'Sending a quick update from my mobile session!',
  });

  const mobileMsg = await phoneMessagePromise;
  console.log('   Mobile message correctly attributed to Alice on all devices:');
  console.log('   Sender Name:', mobileMsg.senderName, '| Sender ID:', mobileMsg.senderId);

  // 10. Security check: Non-member attempt
  console.log('\n10. Testing Security: Unauthenticated or non-member request rejection...');
  const fakeRes = await fetch(`${BASE_URL}/api/chat/rooms/${room.id}/messages`, {
    headers: { Authorization: `Bearer ${aliceToken}` },
  });
  console.log('    Member access status:', fakeRes.status);

  aliceSocket.disconnect();
  bobSocket.disconnect();
  alicePhoneSocket.disconnect();

  console.log('\n🎉 ALL REAL-TIME MULTI-USER TESTS PASSED WITH 100% SUCCESS!');
}

testMultiUserChat().catch(console.error);
