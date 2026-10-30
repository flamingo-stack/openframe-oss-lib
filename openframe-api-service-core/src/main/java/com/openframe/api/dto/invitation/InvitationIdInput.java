package com.openframe.api.dto.invitation;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** The input of revokeInvitation and resendInvitation: a global Invitation id (a raw id is accepted too). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationIdInput {
    @NotBlank
    private String id;
}
