package com.ssafy.websocket.handler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class SessionManager {

    // IP별 세션 관리 (IP 1개 당 1개의 세션만 하용)
    private final Map<String, WebSocketSession> isSessionMap = new ConcurrentHashMap<>();

    // 세션별 사용자 이름 저장
    private final Map<String, WebSocketSession> sessionUsernameMap = new ConcurrentHashMap<>();

    // 세션별 IP 주소 저장
    private final Map<String, WebSocketSession> sessionIpMap = new ConcurrentHashMap<>();

    // 새로운 세션 등록 (IP 중복 체크)

    // IP 주소 조회

    // 세션 정리
}
