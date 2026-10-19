package com.openframe.client.dto.agent;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentCodeSignature {
    @NotNull
    private CodeSignatureStatus status;
    // Apple Team ID on macOS, certificate simple name on Windows
    private String signer;
}
