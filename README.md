# 🚀 WebSocket 실시간 채팅 시스템

Spring Boot와 WebSocket을 활용한 실시간 멀티룸 채팅 시스템입니다.

## 📋 목차
- [프로젝트 개요](#-프로젝트-개요)
- [기술 스택](#-기술-스택)
- [주요 기능](#-주요-기능)
- [백엔드 구현 상세](#-백엔드-구현-상세)
- [프론트엔드 UI](#-프론트엔드-ui)
- [API 명세](#-api-명세)
- [보안 고려사항](#-보안-고려사항)

## 🎯 프로젝트 개요

이 프로젝트는 WebSocket을 사용하여 실시간 양방향 통신을 구현한 채팅 애플리케이션입니다. 
다중 채팅방을 지원하며, IP 기반 중복 접속 방지, 세션 관리, 메시지 제한 등의 기능을 포함합니다.

## 🛠 기술 스택

### Backend
- **Java 21** - 최신 LTS 버전
- **Spring Boot 3.5.3** - 애플리케이션 프레임워크
- **Spring WebSocket** - 실시간 양방향 통신
- **Gradle 8.14.2** - 빌드 도구
- **Lombok** - 코드 간소화
- **Jackson** - JSON 처리

### Frontend
- **HTML5** - 마크업
- **CSS3** - 스타일링 (반응형 디자인)
- **Vanilla JavaScript** - 클라이언트 로직
- **WebSocket API** - 실시간 통신

## ✨ 주요 기능

### 핵심 기능
- **실시간 채팅**: WebSocket을 통한 즉시 메시지 전송/수신
- **멀티룸 채팅**: 여러 채팅방 동시 운영
- **사용자 관리**: 사용자명 기반 식별 시스템
- **세션 관리**: IP 기반 중복 접속 방지

### 보안 및 제한 기능
- **IP 중복 접속 방지**: 동일 IP에서 하나의 연결만 허용
- **메시지 길이 제한**: 최대 200자 제한
- **연속 메시지 제한**: 스팸 방지를 위한 연속 50개 메시지 제한
- **XSS 방지**: HTML 이스케이프 처리

### 사용자 경험
- **실시간 알림**: 입장/퇴장 알림, 방 인원수 표시
- **사용자 친화적 UI**: 직관적인 인터페이스
- **메시지 타입 구분**: 시스템 메시지와 사용자 메시지 분리
- **실시간 로그**: 시스템 동작 상태 확인


### 컴포넌트 구조
```
src/main/java/com/ssafy/websocket/
├── WebSocketApplication.java          # 애플리케이션 진입점
├── config/
│   └── WebSocketConfig.java          # WebSocket 설정
├── handler/
│   ├── WebsocketChatHandler.java     # 메시지 처리 핸들러
│   └── SessionManager.java           # 세션 관리
└── dto/
    └── ChatMessageDto.java           # 메시지 DTO
```

## 🔧 백엔드 구현 상세

### 1. WebSocket 설정 (WebSocketConfig)

```java
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {
    private final WebSocketHandler webSocketHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(webSocketHandler, "/ws/conn")
                .setAllowedOrigins("*");
    }
}
```

**핵심 구현 사항:**
- `@EnableWebSocket`: WebSocket 기능 활성화
- `/ws/conn` 엔드포인트로 WebSocket 연결 수락
- CORS 설정으로 모든 오리진 허용

### 2. 메시지 처리 핸들러 (WebsocketChatHandler)

**주요 메서드:**
- `afterConnectionEstablished()`: 연결 설정 시 처리
- `handleTextMessage()`: 메시지 수신 시 처리
- `afterConnectionClosed()`: 연결 종료 시 처리

**메시지 타입별 처리:**
```java
public enum MeetingType {
    JOIN,   // 채팅방 입장
    TALK,   // 일반 채팅
    LEAVE   // 채팅방 퇴장
}
```

**데이터 구조:**
- `Set<WebSocketSession> sessions`: 전체 연결된 세션
- `Map<Long, Set<WebSocketSession>> chatRoomSessionMap`: 방별 세션 관리

### 3. 세션 관리 (SessionManager)

**핵심 기능:**
- **IP 중복 체크**: 동일 IP 접속 시 기존 연결 종료
- **사용자명 매핑**: 세션과 사용자명 연결
- **자동 정리**: 연결 종료 시 모든 데이터 정리

```java
// IP별 세션 관리
private final Map<String, WebSocketSession> isSessionMap = new ConcurrentHashMap<>();
// 세션별 사용자명 저장  
private final Map<WebSocketSession, String> sessionUsernameMap = new ConcurrentHashMap<>();
```

### 4. 메시지 DTO (ChatMessageDto)

```java
@Builder
public class ChatMessageDto {
    private MeetingType meetingType;  // 메시지 타입
    private Long chatRoomId;          // 채팅방 ID
    private String username;          // 사용자명
    private String message;           // 메시지 내용
    private String clientIp;          // 클라이언트 IP
}
```

### 5. 실시간 방 인원수 관리

방 입장/퇴장 시 실시간으로 인원수를 업데이트하여 모든 참여자에게 브로드캐스트:

```java
private void sendRoomCountUpdate(Long chatRoomId, int roomCount) throws Exception {
    Map<String, Object> roomCountMessage = new HashMap<>();
    roomCountMessage.put("type", "ROOM_COUNT_UPDATE");
    roomCountMessage.put("chatRoomId", chatRoomId);
    roomCountMessage.put("count", roomCount);
    
    String jsonMessage = objectMapper.writeValueAsString(roomCountMessage);
    // 해당 방의 모든 사용자에게 전송
}
```

## 📱 프론트엔드 UI

### 메인 화면
![image](https://github.com/user-attachments/assets/a8ee669d-4fdb-40c1-ad41-30716b5d834b)


### 채팅 화면
![image](https://github.com/user-attachments/assets/b1f3077d-dbe9-479d-8e41-71f03042f31e)


### 시스템 로그
![image](https://github.com/user-attachments/assets/d2bc3d2a-ac7f-4924-8ab4-31def08dcfb5)


## 📡 API 명세

### WebSocket 연결
- **엔드포인트**: `ws://localhost:8080/ws/conn`
- **프로토콜**: WebSocket

### 메시지 포맷

**채팅방 입장**
```json
{
    "meetingType": "JOIN",
    "chatRoomId": 1,
    "username": "사용자명",
    "message": "입장했습니다"
}
```

**채팅 메시지**
```json
{
    "meetingType": "TALK", 
    "chatRoomId": 1,
    "username": "사용자명",
    "message": "안녕하세요!"
}
```

**채팅방 퇴장**
```json
{
    "meetingType": "LEAVE",
    "chatRoomId": 1,
    "username": "사용자명", 
    "message": "퇴장했습니다"
}
```

**방 인원수 업데이트 (서버→클라이언트)**
```json
{
    "type": "ROOM_COUNT_UPDATE",
    "chatRoomId": 1,
    "count": 3
}
```

## 🔒 보안 고려사항

### 백엔드 보안
- **IP 기반 접속 제한**: 동일 IP에서 하나의 연결만 허용
- **세션 관리**: ConcurrentHashMap 사용으로 스레드 안전성 보장
- **메시지 길이 제한**: 최대 200자로 제한하여 DoS 공격 방지
- **연속 메시지 제한**: 스팸 방지를 위한 50개 연속 메시지 제한

### 프론트엔드 보안  
- **XSS 방지**: HTML 이스케이프 처리
```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```
- **입력 검증**: 사용자명, 메시지 유효성 검사
- **실시간 검증**: 입력 시 즉시 유효성 검사 수행

## 🔄 개발 프로세스

1. **요구사항 분석**: 실시간 채팅 기본 기능 정의
2. **기술 스택 선정**: Spring Boot + WebSocket 조합 선택  
3. **아키텍처 설계**: 세션 관리와 메시지 처리 구조 설계
4. **백엔드 구현**: WebSocket 핸들러와 세션 관리자 구현
5. **프론트엔드 구현**: 반응형 웹 UI와 실시간 통신 로직 구현
6. **보안 강화**: XSS 방지, 메시지 제한, IP 중복 방지 구현
7. **테스트 및 최적화**: 다중 사용자 환경에서의 안정성 검증
