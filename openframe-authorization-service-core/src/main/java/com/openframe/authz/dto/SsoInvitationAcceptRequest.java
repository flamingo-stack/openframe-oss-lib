package com.openframe.authz.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SsoInvitationAcceptRequest {
    @NotBlank
    private String invitationId;
    @NotBlank
    private String provider;
    private Boolean switchTenant;
    private String redirectTo;
}
