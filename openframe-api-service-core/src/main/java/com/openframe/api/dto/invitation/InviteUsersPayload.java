package com.openframe.api.dto.invitation;

import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.MutationError;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteUsersPayload {
    private List<GenericEdge<InvitationResponse>> invitationEdges;
    private List<MutationError> userErrors;
}
