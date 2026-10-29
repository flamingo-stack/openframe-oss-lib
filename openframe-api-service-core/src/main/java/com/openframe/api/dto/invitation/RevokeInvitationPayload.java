package com.openframe.api.dto.invitation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevokeInvitationPayload {
    /** Global id. */
    private String revokedInvitationId;
}
