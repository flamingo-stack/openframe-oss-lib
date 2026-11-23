package com.openframe.client.dto.identitysplit;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IdentitySplitRequest {

    @NotBlank
    private String sessionId;

}
