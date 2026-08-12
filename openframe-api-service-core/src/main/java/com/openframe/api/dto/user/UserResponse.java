package com.openframe.api.dto.user;

import com.openframe.api.dto.image.ImageDto;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class UserResponse {

    public static final String SYSTEM_ID = "SYSTEM";
    public static final String EMPTY = "";

    private String id;
    private String email;
    private boolean emailVerified;
    private String firstName;
    private String lastName;
    private List<String> roles;
    private String status;
    private ImageDto image;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static UserResponse system() {
        return UserResponse.builder()
                .id(SYSTEM_ID)
                .firstName(SYSTEM_ID)
                .lastName(EMPTY)
                .build();
    }
}


