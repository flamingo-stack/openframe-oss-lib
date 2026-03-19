package com.openframe.test.data.dto.invitation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AcceptInvitationRequest {
    private String invitationId;
    private String firstName;
    private String lastName;
    private String password;
    @Builder.Default
    private boolean switchTenant = false;
}
