package com.openframe.client.service.validator;

import com.openframe.client.config.AgentCodeSignaturePolicyProperties;
import com.openframe.client.dto.agent.AgentCodeSignature;
import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.exception.UntrustedAgentSignatureException;
import com.openframe.core.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static com.openframe.client.config.CodeSignaturePolicyMode.DISABLED;
import static com.openframe.client.config.CodeSignaturePolicyMode.ENFORCE;
import static com.openframe.client.config.CodeSignaturePolicyMode.LOG_ONLY;
import static com.openframe.client.dto.agent.CodeSignatureStatus.INVALID;
import static com.openframe.client.dto.agent.CodeSignatureStatus.UNSIGNED;
import static com.openframe.client.dto.agent.CodeSignatureStatus.VALID;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AgentCodeSignatureValidatorTest {

    private static final String MAC_OS = "MAC_OS";
    private static final String WINDOWS = "WINDOWS";
    private static final String APPLE_TEAM_ID = "F7LDSU8JPJ";
    private static final String WINDOWS_SIGNER = "Flamingo AI, Inc.";

    private AgentCodeSignaturePolicyProperties policy;
    private AgentCodeSignatureValidator validator;

    @BeforeEach
    void setUp() {
        policy = new AgentCodeSignaturePolicyProperties();
        policy.setMode(ENFORCE);
        policy.setTrustedSigners(Map.of(
                MAC_OS, List.of(APPLE_TEAM_ID),
                WINDOWS, List.of(WINDOWS_SIGNER)));
        validator = new AgentCodeSignatureValidator(policy);
    }

    @Test
    void validate_WithTrustedMacSigner_Passes() {
        AgentCodeSignature signature = new AgentCodeSignature(VALID, APPLE_TEAM_ID);
        AgentRegistrationRequest request = request(MAC_OS, signature);

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_WithTrustedWindowsSigner_Passes() {
        AgentCodeSignature signature = new AgentCodeSignature(VALID, WINDOWS_SIGNER);
        AgentRegistrationRequest request = request(WINDOWS, signature);

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_WithForeignSigner_Throws() {
        AgentCodeSignature signature = new AgentCodeSignature(VALID, "ATTACKER01");
        AgentRegistrationRequest request = request(MAC_OS, signature);

        UntrustedAgentSignatureException ex = assertThrows(
                UntrustedAgentSignatureException.class,
                () -> validator.validate(request)
        );
        assertEquals(ErrorCode.AGENT_SIGNATURE_UNTRUSTED, ex.getErrorCode());
    }

    @Test
    void validate_WithTrustedSignerOfOtherOs_Throws() {
        AgentCodeSignature signature = new AgentCodeSignature(VALID, WINDOWS_SIGNER);
        AgentRegistrationRequest request = request(MAC_OS, signature);

        assertThrows(UntrustedAgentSignatureException.class, () -> validator.validate(request));
    }

    @Test
    void validate_WithModifiedBinary_Throws() {
        AgentCodeSignature signature = new AgentCodeSignature(INVALID, null);
        AgentRegistrationRequest request = request(MAC_OS, signature);

        assertThrows(UntrustedAgentSignatureException.class, () -> validator.validate(request));
    }

    @Test
    void validate_WithUnsignedBinary_Throws() {
        AgentCodeSignature signature = new AgentCodeSignature(UNSIGNED, null);
        AgentRegistrationRequest request = request(WINDOWS, signature);

        assertThrows(UntrustedAgentSignatureException.class, () -> validator.validate(request));
    }

    @Test
    void validate_WithInvalidStatusButTrustedSigner_Throws() {
        AgentCodeSignature signature = new AgentCodeSignature(INVALID, APPLE_TEAM_ID);
        AgentRegistrationRequest request = request(MAC_OS, signature);

        assertThrows(UntrustedAgentSignatureException.class, () -> validator.validate(request));
    }

    @Test
    void validate_WithoutSignatureFromOlderAgent_Throws() {
        AgentRegistrationRequest request = request(MAC_OS, null);

        assertThrows(UntrustedAgentSignatureException.class, () -> validator.validate(request));
    }

    @Test
    void validate_InLogOnlyMode_AllowsUntrustedAgent() {
        policy.setMode(LOG_ONLY);
        AgentCodeSignature signature = new AgentCodeSignature(UNSIGNED, null);
        AgentRegistrationRequest request = request(MAC_OS, signature);

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_WhenDisabled_AllowsUntrustedAgent() {
        policy.setMode(DISABLED);
        AgentRegistrationRequest request = request(MAC_OS, null);

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_WithoutSignersForOs_Passes() {
        policy.setTrustedSigners(Map.of(WINDOWS, List.of(WINDOWS_SIGNER)));
        AgentRegistrationRequest request = request(MAC_OS, null);

        assertDoesNotThrow(() -> validator.validate(request));
    }

    private static AgentRegistrationRequest request(String osType, AgentCodeSignature signature) {
        AgentRegistrationRequest request = new AgentRegistrationRequest();
        request.setHostname("host");
        request.setOrganizationId("org-1");
        request.setOsType(osType);
        request.setCodeSignature(signature);
        return request;
    }
}
