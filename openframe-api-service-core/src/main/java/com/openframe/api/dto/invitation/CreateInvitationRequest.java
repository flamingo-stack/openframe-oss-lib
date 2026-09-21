package com.openframe.api.dto.invitation;

import com.openframe.api.dto.Role;
import com.openframe.core.validation.ValidEmail;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateInvitationRequest {
    @ValidEmail
    private String email;

    private List<Role> roles;
}


