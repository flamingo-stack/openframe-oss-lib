package com.openframe.api.dto.invitation;

import com.openframe.api.dto.GenericEdge;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResendInvitationPayload {
    private GenericEdge<InvitationResponse> invitationEdge;
    /** Global id. */
    private String revokedInvitationId;
}
