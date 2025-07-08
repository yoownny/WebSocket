package com.ssafy.websocket.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.websocket.dto.ChatMessageDto;
import com.ssafy.websocket.dto.ChatMessageDto.MeetingType;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.HashSet;
import java.util.Set;

@Slf4j
@Component // Spring Bean으로 등록
@RequiredArgsConstructor
// 텍스트 메시지 처리에 특화된 Spring 제공 웹소켓 처리 클래스
public class WebsocketChatHandler extends TextWebSocketHandler {
    // Json -> Java 객체 변환 도구
    private final ObjectMapper objectMapper;

    // 사용자별로 고유한 세션 ID가 있음
    // 현재 연결된 모든 사용자들의 세션을 저장하는 집합
    private final Set<WebSocketSession> sessions = new HashSet<>();

    // 채팅방ID와 해당 방에 접속한 사용자들의 세션 집합
    private final Map<Long, Set<WebSocketSession>> chatRoomSessionMap = new HashMap<>();

    // 연결
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("{} 연결됨",session.getId());
        sessions.add(session); // 새로운 사용자를 접속자 목록에 추가
        session.sendMessage(new TextMessage("WebSocket 연결 완료")); // 연결된 사용자에게 환영 메시지 전송
    }

    // 메시지 처리
    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload(); // 받은 매시지의 실제 내용
        log.info("payload {}",payload);

        // 클라이언트로부터 받은 메시지를 ChatMessageDto로 변환
        ChatMessageDto chatMessageDto = objectMapper.readValue(payload, ChatMessageDto.class);
        log.info("chatMessageDto {}", chatMessageDto.toString());

        // 메시지 타입에 따른 분기
        if(chatMessageDto.getMeetingType().equals(MeetingType.JOIN)){
            chatRoomSessionMap.computeIfAbsent(chatMessageDto.getChatRoomId(), s -> new HashSet<>()).add(session);
            chatMessageDto.setMessage("님이 입장하셨습니다.");
        }else if (chatMessageDto.getMeetingType().equals(MeetingType.LEAVE)){
            chatRoomSessionMap.remove(chatMessageDto.getChatRoomId()).remove(session);
            chatMessageDto.setMessage("님이 퇴장하셨습니다.");
        }

        for(WebSocketSession webSocketSession : chatRoomSessionMap.get(chatMessageDto.getChatRoomId())){
            webSocketSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(chatMessageDto)));
        }
    }

    // 연결 종료
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("{} 연결 끊김",session.getId());
        sessions.remove(session); // 접속자 목록에서 해당 사용자 제거

        // 모든 채팅방에서 해당 세션 제거
        for (Set<WebSocketSession> roomSessions : chatRoomSessionMap.values()) {
            roomSessions.remove(session);
        }
    }
}
