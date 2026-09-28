package com.openframe.authz.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class InvitationRegistrationRequest extends CoreUserRequest {

    /**
     * Builds the request an SSO callback finalizes with: names resolved by the caller (token vs
     * Apple form-param fallback differs by flow), a random password (SSO users never use it), and
     * the invitation's own email/tenant filled in by {@code InvitationRegistrationService}.
     */
    public static InvitationRegistrationRequest fromSso(String invitationId, String firstName, String lastName,
                                                        String pictureUrl, boolean switchTenant) {
        return InvitationRegistrationRequest.builder()
                .invitationId(invitationId)
                .firstName(firstName != null ? firstName : "")
                .lastName(lastName != null ? lastName : "")
                .password(java.util.UUID.randomUUID().toString())
                .pictureUrl(pictureUrl)
                .switchTenant(switchTenant)
                .build();
    }

    @NotBlank
    private String invitationId;

    private Boolean switchTenant;
}


