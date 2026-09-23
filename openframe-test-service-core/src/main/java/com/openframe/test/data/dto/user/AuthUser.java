package com.openframe.test.data.dto.user;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AuthUser {
    private String id;
    private String tenantId;
    // Sensitive, runtime-only value: excluded from toString() to avoid accidental logging/exposure.
    @ToString.Exclude
    private String passwordHash;
    private Boolean emailVerified;
    private String loginProvider;
    private String email;
    private String firstName;
    private String lastName;
    private List<UserRole> roles;
    private UserStatus status;
    private Object image;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
