package com.ssafy.websocket.handler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class SessionManager {

    // IP별 세션 관리 (IP 1개 당 1개의 세션만 하용)
    private final Map<String, WebSocketSession> isSessionMap = new ConcurrentHashMap<>();

    // 세션별 사용자 이름 저장
    private final Map<WebSocketSession, String> sessionUsernameMap = new ConcurrentHashMap<>();

    // 세션별 IP 주소 저장
    private final Map<WebSocketSession, String> sessionIsMap = new ConcurrentHashMap<>();

    // 새로운 세션 등록 (IP 중복 체크)
    public WebSocketSession registerSession(WebSocketSession session) throws Exception {
        String clientIp = getClientIp(session);
        log.info("새 연결 시도: ID={}, IP={}", session.getId(), clientIp);

        WebSocketSession removedSession = null;

        // IP 중복 체크
        WebSocketSession existingSession = isSessionMap.get(clientIp);
        if (existingSession != null && existingSession.isOpen()) {
            log.warn("IP 중복 접속 시도: IP={}, 기존 세션={}, 새 세션={}", clientIp, existingSession.getId(), session.getId());

            // 기존 연결 강제 종료
            existingSession.sendMessage(new TextMessage("다른 곳에서 접속하여 연결이 종료됩니다."));
            existingSession.close(CloseStatus.POLICY_VIOLATION); // 정책 위반이라는 이유로 연결을 강제로 종료

            // 기존 세션 정리
            cleanupSession(existingSession);
            removedSession = existingSession;
        }
        isSessionMap.put(clientIp, session);
        sessionIsMap.put(session, clientIp);

        return removedSession;
    }

    // IP 주소 조회
    private String getClientIp(WebSocketSession session) {
        // 세션에 이미 저장된 IP가 있으면 반환
        String storedIp = sessionIsMap.get(session);
        if(storedIp != null) {
            return storedIp;
        }

        // 클라이언트의 원격 주소(IP 주소와 포트 번호)를 반환
        return session.getRemoteAddress().getAddress().getHostAddress();
    }

    // 기존 세션 정리
    public void cleanupSession(WebSocketSession session) {
        String clientIp = getClientIp(session);

        // 모든 맵에서 세션 제거
        sessionUsernameMap.remove(session);
        sessionIsMap.remove(session);

        // IP도 삭제
        isSessionMap.remove(clientIp);
    }

    // 사용자 이름 저장
    public void setUsername(WebSocketSession session, String username) {
        sessionUsernameMap.put(session, username);
    }
    
    // 사용자 이름 조회
    public String getUsername(WebSocketSession session) {
        return sessionUsernameMap.get(session);
    }
}
