package com.openframe.api.dto.user;

import com.openframe.api.dto.image.ImageDto;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class UserResponse {
    private String id;
    private String email;
    private String firstName;
    private String lastName;
    private List<String> roles;
    private String status;
    private ImageDto image;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}


