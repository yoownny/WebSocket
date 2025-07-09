package com.ssafy.websocket.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessageDto {
    private MeetingType meetingType; // 메시지 타입
    private Long chatRoomId; // 방 번호
    private String username; // 사용자 이름
    private String message; // 메시지

    // 메시지 타입 : 입장, 채팅, 퇴장
    public enum MeetingType {
        JOIN, TALK, LEAVE
    }
}
