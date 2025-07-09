let websocket = null;
let currentChatRoomId = null;
const MAX_MESSAGE_LENGTH = 200;
const MAX_CONSECUTIVE_MESSAGES = 50;
let consecutiveMessageCount = 0;
let lastMessageSender = null;

// DOM 요소들
const statusDiv = document.getElementById('status');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');
const messagesDiv = document.getElementById('messages');
const logsDiv = document.getElementById('logs');
const currentRoomSpan = document.getElementById('currentRoom');
const roomCountSpan = document.getElementById('roomCount');
const usernameInput = document.getElementById('username');
const charCounter = document.getElementById('charCounter');
const lengthWarning = document.getElementById('lengthWarning');
const roomWarning = document.getElementById('roomWarning');
const usernameError = document.getElementById('usernameError');

// DOM 로드 완료 시 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    // 메시지 입력 글자 수 카운터
    messageInput.addEventListener('input', function() {
        const length = this.value.length;
        charCounter.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;

        // 글자 수에 따른 색상 변경
        if (length >= MAX_MESSAGE_LENGTH) {
            charCounter.className = 'char-counter danger';
            lengthWarning.textContent = '메시지가 최대 길이에 도달했습니다.';
            lengthWarning.style.display = 'block';
        } else if (length >= MAX_MESSAGE_LENGTH * 0.8) {
            charCounter.className = 'char-counter warning';
            lengthWarning.style.display = 'none';
        } else {
            charCounter.className = 'char-counter';
            lengthWarning.style.display = 'none';
        }
    });

    // 엔터키로 메시지 전송
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !sendBtn.disabled) {
            sendMessage();
        }
    });

    // 사용자 이름 입력 시 실시간 검증
    usernameInput.addEventListener('input', function() {
        const username = this.value.trim();
        const validation = validateUsername(username);

        if (!validation.valid && username.length > 0) {
            this.classList.add('username-required');
            usernameError.textContent = '⚠️ ' + validation.message;
            usernameError.style.display = 'block';
        } else if (validation.valid) {
            this.classList.remove('username-required');
            usernameError.style.display = 'none';
        } else {
            this.classList.add('username-required');
            usernameError.textContent = '⚠️ 사용자 이름을 반드시 입력해야 서버에 연결할 수 있습니다!';
            usernameError.style.display = 'block';
        }
    });

    // 사용자 이름 입력 시 엔터키로 연결
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            connect();
        }
    });
});

// 사용자 이름 유효성 검사
function validateUsername(username) {
    // 공백 제거 후 체크
    username = username.trim();

    if (!username) {
        return { valid: false, message: '사용자 이름을 입력해주세요.' };
    }

    if (username.length < 2) {
        return { valid: false, message: '사용자 이름은 최소 2글자 이상이어야 합니다.' };
    }

    if (username.length > 20) {
        return { valid: false, message: '사용자 이름은 최대 20글자까지 가능합니다.' };
    }

    // 특수문자 체크 (한글, 영문, 숫자, 일부 특수문자만 허용)
    const validPattern = /^[가-힣a-zA-Z0-9\s_-]+$/;
    if (!validPattern.test(username)) {
        return { valid: false, message: '사용자 이름에는 한글, 영문, 숫자, 공백, _, - 만 사용 가능합니다.' };
    }

    return { valid: true, message: '' };
}

// WebSocket 연결
function connect() {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    const username = usernameInput.value.trim();

    // 사용자 이름 검증
    const validation = validateUsername(username);
    if (!validation.valid) {
        usernameInput.classList.add('username-required');
        usernameError.textContent = '⚠️ ' + validation.message;
        usernameError.style.display = 'block';
        usernameInput.focus();
        return;
    }

    // 서버 URL 검증
    if (!serverUrl) {
        alert('서버 URL을 입력해주세요!');
        return;
    }

    try {
        addLog(`🔄 ${username} 이름으로 서버에 연결 시도 중...`);
        websocket = new WebSocket(serverUrl);

        websocket.onopen = function() {
            updateStatus('연결됨 ✅', true);
            addLog(`✅ WebSocket 연결 성공 (사용자: ${username})`);

            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            joinBtn.disabled = false;
            usernameInput.disabled = true; // 연결 후 이름 변경 방지
            usernameError.style.display = 'none';
            usernameInput.classList.remove('username-required');
        };

        websocket.onmessage = function(event) {
            const data = event.data;
            addLog('📨 수신: ' + data);

            // IP 중복 접속 처리
            if (data.includes('다른 곳에서 접속하여') || data.includes('중복 접속')) {
                alert(`⚠️ 다른 곳에서 같은 IP로 접속하여 현재 연결이 종료됩니다.`);
                addLog('🚨 IP 중복 접속으로 인한 연결 종료');
                return;
            }

            // JSON 메시지인지 확인
            try {
                const messageData = JSON.parse(data);

                // 방 인원 수 업데이트 메시지인지 확인
                if (messageData.type === 'ROOM_COUNT_UPDATE') {
                    updateRoomCount(messageData.count);
                } else {
                    // 일반 채팅 메시지
                    displayMessage(messageData);
                }
            } catch (e) {
                // 일반 텍스트 메시지 (연결 완료 메시지 등)
                displayTextMessage(data);
            }
        };

        websocket.onclose = function(event) {
            const reason = event.reason || '알 수 없는 이유';
            const code = event.code;

            updateStatus('연결 끊어짐 ❌', false);

            if (code === 1008) { // Policy Violation (IP 중복)
                addLog('❌ IP 중복 접속으로 인한 연결 종료');
                displayTextMessage('🚨 다른 곳에서 같은 IP로 접속하여 연결이 종료되었습니다.');
            } else {
                addLog(`❌ WebSocket 연결 종료 (코드: ${code}, 사유: ${reason})`);
                displayTextMessage('🔌 서버와의 연결이 끊어졌습니다. 입장했던 모든 채팅방에서 자동으로 퇴장되었습니다.');
            }

            resetButtons();
        };

        websocket.onerror = function(error) {
            addLog('🚨 WebSocket 오류: ' + error);
            updateStatus('연결 오류 ⚠️', false);
        };

    } catch (error) {
        addLog('🚨 연결 실패: ' + error.message);
        updateStatus('연결 실패 ❌', false);
    }
}

// WebSocket 연결 해제
function disconnect() {
    if (websocket) {
        addLog('🔌 사용자가 연결 해제를 요청했습니다...');
        displayTextMessage('🔌 연결을 해제합니다. 입장했던 모든 채팅방에서 자동으로 퇴장됩니다.');
        websocket.close(1000, '사용자 요청으로 연결 해제'); // 정상 종료 코드
    }
}

// 채팅방 입장
function joinRoom() {
    const chatRoomId = parseInt(document.getElementById('chatRoomId').value);
    const username = usernameInput.value.trim();

    if (!chatRoomId) {
        alert('채팅방 ID를 입력하세요.');
        return;
    }

    if (!username) {
        alert('사용자 이름을 입력하세요.');
        return;
    }

    // 이미 다른 방에 입장한 상태인지 확인
    if (currentChatRoomId !== null && currentChatRoomId !== chatRoomId) {
        alert(`현재 채팅방 ${currentChatRoomId}에 입장 중입니다.\n새로운 방에 입장하려면 먼저 현재 방에서 퇴장해주세요.`);
        roomWarning.style.display = 'block';
        return;
    }

    // 같은 방에 다시 입장하려는 경우 방지
    if (currentChatRoomId === chatRoomId) {
        alert(`이미 채팅방 ${chatRoomId}에 입장해 있습니다.`);
        return;
    }

    // 경고 메시지 숨기기
    roomWarning.style.display = 'none';

    // 새로운 방 입장 시 채팅 내용 지우기 및 연속 메시지 카운트 리셋
    clearMessages();
    displayTextMessage(`채팅방 ${chatRoomId}에 입장했습니다.`);
    consecutiveMessageCount = 0;
    lastMessageSender = null;

    const message = {
        meetingType: 'JOIN',
        chatRoomId: chatRoomId,
        username: username,
        message: '입장했습니다'
    };

    sendWebSocketMessage(message);
    currentChatRoomId = chatRoomId;
    currentRoomSpan.textContent = `방 ${chatRoomId}`;

    leaveBtn.disabled = false;
    messageInput.disabled = false;
    sendBtn.disabled = false;

    addLog(`🚪 채팅방 ${chatRoomId}에 입장했습니다.`);
}

// 채팅방 퇴장
function leaveRoom() {
    if (currentChatRoomId === null) {
        alert('입장한 채팅방이 없습니다.');
        return;
    }

    const username = usernameInput.value.trim();
    const message = {
        meetingType: 'LEAVE',
        chatRoomId: currentChatRoomId,
        username: username,
        message: '퇴장했습니다'
    };

    sendWebSocketMessage(message);

    addLog(`🚪 채팅방 ${currentChatRoomId}에서 퇴장했습니다.`);

    currentChatRoomId = null;
    currentRoomSpan.textContent = '없음';
    roomCountSpan.textContent = '0명';

    leaveBtn.disabled = true;
    messageInput.disabled = true;
    sendBtn.disabled = true;

    // 경고 메시지 숨기기 및 연속 메시지 카운트 리셋
    roomWarning.style.display = 'none';
    consecutiveMessageCount = 0;
    lastMessageSender = null;
}

// 메시지 전송
function sendMessage() {
    const messageText = messageInput.value.trim();
    const username = usernameInput.value.trim();

    if (!messageText) {
        alert('메시지를 입력하세요.');
        return;
    }

    if (messageText.length > MAX_MESSAGE_LENGTH) {
        alert(`메시지가 너무 깁니다. 최대 ${MAX_MESSAGE_LENGTH}자까지 입력 가능합니다.`);
        return;
    }

    if (!username) {
        alert('사용자 이름을 입력하세요.');
        return;
    }

    if (currentChatRoomId === null) {
        alert('먼저 채팅방에 입장하세요.');
        return;
    }

    // 연속 메시지 체크
    if (lastMessageSender === username) {
        consecutiveMessageCount++;
    } else {
        consecutiveMessageCount = 1;
        lastMessageSender = username;
    }

    // 연속 메시지 제한 체크
    if (consecutiveMessageCount > MAX_CONSECUTIVE_MESSAGES) {
        alert(`⚠️ 연속으로 ${MAX_CONSECUTIVE_MESSAGES}개 이상의 메시지를 보냈습니다.\n다른 사용자가 메시지를 보낼 때까지 잠시 기다려주세요!`);
        addLog(`🚨 연속 메시지 제한: ${consecutiveMessageCount}개 연속 전송 시도`);
        return;
    }

    // 연속 메시지 경고 (40개 이상일 때)
    if (consecutiveMessageCount >= 40) {
        const remaining = MAX_CONSECUTIVE_MESSAGES - consecutiveMessageCount;
        addLog(`⚠️ 연속 메시지 경고: ${remaining}개 더 보내면 전송이 제한됩니다.`);
    }

    const message = {
        meetingType: 'TALK',
        chatRoomId: currentChatRoomId,
        username: username,
        message: messageText
    };

    sendWebSocketMessage(message);
    messageInput.value = '';
    messageInput.focus();

    // 글자 수 카운터 리셋
    charCounter.textContent = '0/200';
    charCounter.className = 'char-counter';
    lengthWarning.style.display = 'none';
}

// WebSocket 메시지 전송
function sendWebSocketMessage(message) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        const jsonMessage = JSON.stringify(message);
        websocket.send(jsonMessage);
        addLog('📤 전송: ' + jsonMessage);
    } else {
        alert('WebSocket이 연결되지 않았습니다.');
    }
}

// 채팅 메시지 표시
function displayMessage(messageDto) {
    const messageDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    const currentUsername = usernameInput.value.trim();

    // 다른 사용자의 메시지를 받으면 연속 메시지 카운트 리셋
    if (messageDto.meetingType === 'TALK' && messageDto.username !== currentUsername) {
        if (lastMessageSender === currentUsername && consecutiveMessageCount > 0) {
            addLog(`✅ 다른 사용자가 메시지를 보내서 연속 메시지 카운트가 리셋되었습니다.`);
        }
        consecutiveMessageCount = 0;
        lastMessageSender = messageDto.username;
    }

    if (messageDto.meetingType === 'JOIN' || messageDto.meetingType === 'LEAVE') {
        // 시스템 메시지 (입장/퇴장)
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
                <div class="message-bubble">
                    <strong>${messageDto.username}</strong>님이 ${messageDto.message}
                </div>
            `;
    } else if (messageDto.meetingType === 'TALK') {
        // 채팅 메시지
        const isMyMessage = messageDto.username === currentUsername;

        messageDiv.className = `message user-message ${isMyMessage ? 'my-message' : 'other-message'}`;

        if (isMyMessage) {
            // 내 메시지 (오른쪽 정렬, 시간이 말풍선 왼쪽에)
            messageDiv.innerHTML = `
                    <div style="display: flex; align-items: flex-end; justify-content: flex-end;">
                        <div class="message-time">${timestamp}</div>
                        <div class="message-bubble">${messageDto.message}</div>
                    </div>
                `;
        } else {
            // 다른 사람 메시지 (왼쪽 정렬, 이름과 시간 표시)
            messageDiv.innerHTML = `
                    <div class="message-header">
                        <span class="username">${messageDto.username}</span>
                    </div>
                    <div style="display: flex; align-items: flex-end;">
                        <div class="message-bubble">${messageDto.message}</div>
                        <div class="message-time">${timestamp}</div>
                    </div>
                `;
        }
    }

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 일반 텍스트 메시지 표시
function displayTextMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';

    messageDiv.innerHTML = `
            <div class="message-bubble">${text}</div>
        `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 상태 업데이트
function updateStatus(text, connected) {
    statusDiv.textContent = text;
    statusDiv.className = 'status ' + (connected ? 'connected' : 'disconnected');
}

// 버튼 상태 리셋
function resetButtons() {
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    joinBtn.disabled = true;
    leaveBtn.disabled = true;
    sendBtn.disabled = true;
    messageInput.disabled = true;
    usernameInput.disabled = false;

    currentChatRoomId = null;
    currentRoomSpan.textContent = '없음';
    roomCountSpan.textContent = '0명';
    roomWarning.style.display = 'none';
    usernameError.style.display = 'none';
    usernameInput.classList.remove('username-required');

    // 연속 메시지 카운트 리셋
    consecutiveMessageCount = 0;
    lastMessageSender = null;
}

// 방 인원 수 업데이트
function updateRoomCount(count) {
    roomCountSpan.textContent = `${count}명`;
    addLog(`👥 현재 방 인원: ${count}명`);
}

// 로그 추가
function addLog(message) {
    const logDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    logDiv.innerHTML = `<span style="color: #666;">[${timestamp}]</span> ${message}`;
    logsDiv.appendChild(logDiv);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

// 메시지 지우기
function clearMessages() {
    messagesDiv.innerHTML = '';
}

// 로그 지우기
function clearLogs() {
    logsDiv.innerHTML = '';
}