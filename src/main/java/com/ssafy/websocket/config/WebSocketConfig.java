package com.ssafy.websocket.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration // Spring 설정
@EnableWebSocket // WebSocket 기능 활성화
@RequiredArgsConstructor // final 필드 생성자 자동 생성
public class WebSocketConfig implements WebSocketConfigurer {
    // 실제 웹소켓 요청을 처리할 핸들러 객체 -> WebSocketChatHandler
    private final WebSocketHandler webSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 어떤 경로에 어떤 핸들러를 연결할지 설정 정보를 저장
        registry.addHandler(webSocketHandler, "/ws/conn")
                .setAllowedOrigins("*");
    }
}
