package com.openframe.test.data.dto.invitation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Invitation {

    private String id;
    private String email;
    @Builder.Default
    private List<UserRole> roles = new ArrayList<>();
    private Instant expiresAt;
    @Builder.Default
    private InvitationStatus status = InvitationStatus.PENDING;
    private Instant createdAt;
    private Instant updatedAt;
}
