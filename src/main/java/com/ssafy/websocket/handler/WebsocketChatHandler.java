package com.ssafy.websocket.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.websocket.dto.ChatMessageDto;
import com.ssafy.websocket.dto.ChatMessageDto.MeetingType;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Slf4j
@Component // Spring Bean으로 등록
@RequiredArgsConstructor
// 텍스트 메시지 처리에 특화된 Spring 제공 웹소켓 처리 클래스
public class WebsocketChatHandler extends TextWebSocketHandler {
    // Json -> Java 객체 변환 도구
    private final ObjectMapper objectMapper;
    private final SessionManager sessionManager;

    // 현재 연결된 모든 사용자들의 세션을 저장하는 집합
    private final Set<WebSocketSession> sessions = new HashSet<>();

    // 채팅방ID와 해당 방에 접속한 사용자들의 세션 집합
    private final Map<Long, Set<WebSocketSession>> chatRoomSessionMap = new HashMap<>();

    // 연결
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // 세션 등록 (IP 중복 체크)
        WebSocketSession removedSession = sessionManager.registerSession(session);

        // 중복 IP로 기존 세션이 제거된 경우
        if (removedSession != null) {
            // 전체 세션 목록에서 제거
            sessions.remove(removedSession);
            // 모든 채팅방에서 세션 제거
            for (Set<WebSocketSession> roomSessions : chatRoomSessionMap.values()) {
                roomSessions.remove(removedSession);
            }
        }

        // 새로운 사용자를 접속자 목록에 추가
        sessions.add(session);
        session.sendMessage(new TextMessage("WebSocket 연결 완료")); // 연결된 사용자에게 환영 메시지 전송
    }


    // 메시지 처리
    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload(); // 받은 매시지의 실제 내용
        log.info("메시지 수신: SessionID={}, IP={}, Payload={}", session.getId(), session.getRemoteAddress(), payload);

        // 클라이언트로부터 받은 메시지를 ChatMessageDto로 변환
        ChatMessageDto chatMessageDto = objectMapper.readValue(payload, ChatMessageDto.class);
        log.info("chatMessageDto {}", chatMessageDto.toString());

        // 메시지 타입에 따른 분기
        if (chatMessageDto.getMeetingType().equals(MeetingType.JOIN)) {
            // 사용자 이름 저장
            sessionManager.setUsername(session, chatMessageDto.getUsername());

            // 채팅방에 세션 추가
            chatRoomSessionMap.computeIfAbsent(chatMessageDto.getChatRoomId(), s -> new HashSet<>()).add(session);

            // 방 인원 수 계산
            int roomCount = chatRoomSessionMap.get(chatMessageDto.getChatRoomId()).size();

            log.info("사용자 {}가 채팅방 {}에 입장", chatMessageDto.getUsername(), chatMessageDto.getChatRoomId());

            // 방 인원 수 정보를 모든 사용자에게 전송
            sendRoomCountUpdate(chatMessageDto.getChatRoomId(), roomCount);

        } else if (chatMessageDto.getMeetingType().equals(MeetingType.LEAVE)) {
            // 채팅방에서 세션 제거
            Set<WebSocketSession> roomSessions = chatRoomSessionMap.get(chatMessageDto.getChatRoomId());

            // 방 인원 수 계산
            int roomCount = roomSessions.size();

            if (roomSessions != null) {
                roomSessions.remove(session);

                log.info("사용자 {}가 채팅방 {}에서 퇴장", chatMessageDto.getUsername(), chatMessageDto.getChatRoomId());

                // 방 인원 수 정보를 모든 사용자에게 전송
                sendRoomCountUpdate(chatMessageDto.getChatRoomId(), roomCount);
            }
        }

        // 해당 채팅방의 모든 사용자에게 메시지 전송
        Set<WebSocketSession> roomSessions = chatRoomSessionMap.get(chatMessageDto.getChatRoomId());
        if (roomSessions != null) {
            for (WebSocketSession webSocketSession : roomSessions) {
                try {
                    webSocketSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(chatMessageDto)));
                } catch (Exception e) {
                    log.error("메시지 전송 실패: {}", e.getMessage());
                }
            }
        }
    }

    // 연결 종료
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("연결 종료: ID={}, IP={}, Status={}", session.getId(), session.getRemoteAddress(), status);
        sessions.remove(session); // 접속자 목록에서 해당 사용자 제거

        // 모든 채팅방에서 해당 세션 제거하고 인원 수 업데이트
        for (Map.Entry<Long, Set<WebSocketSession>> entry : chatRoomSessionMap.entrySet()) {
            Set<WebSocketSession> roomSessions = entry.getValue();
            if (roomSessions.remove(session)) {
                // 해당 방에서 세션이 제거되었으면 인원 수 업데이트 전송
                int roomCount = roomSessions.size();
                log.info("연결 종료로 인한 방 인원 변경 - Room: {}, 현재 인원: {}명", entry.getKey(), roomCount);
                sendRoomCountUpdate(entry.getKey(), roomCount);
            }
        }
        sessionManager.cleanupSession(session);
    }

    // 방 인원 수 업데이트를 해당 방의 모든 사용자에게 전송
    private void sendRoomCountUpdate(Long chatRoomId, int roomCount) throws Exception {
        Set<WebSocketSession> roomSessions = chatRoomSessionMap.get(chatRoomId);
        if (roomSessions != null && !roomSessions.isEmpty()) {
            // 방 인원 수 정보 메시지 생성
            Map<String, Object> roomCountMessage = new HashMap<>();
            roomCountMessage.put("type", "ROOM_COUNT_UPDATE");
            roomCountMessage.put("chatRoomId", chatRoomId);
            roomCountMessage.put("count", roomCount);

            String jsonMessage = objectMapper.writeValueAsString(roomCountMessage);

            // 해당 방의 모든 사용자에게 전송
            for (WebSocketSession session : roomSessions) {
                session.sendMessage(new TextMessage(jsonMessage));
            }
            log.info("방 인원 수 업데이트 전송 - Room: {}, Count: {}", chatRoomId, roomCount);
        }
    }
}
