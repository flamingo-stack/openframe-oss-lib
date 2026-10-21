package com.openframe.client.service.validator;

import com.openframe.client.config.AgentBinaryPolicyProperties;
import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.exception.UntrustedAgentBinaryException;
import com.openframe.client.service.release.ReleaseChecksumCatalog;
import com.openframe.client.service.release.model.ReleaseBinaryChecksums;
import com.openframe.client.service.release.model.ReleaseChecksumLookup;
import com.openframe.core.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static com.openframe.client.config.AgentBinaryPolicyMode.DISABLED;
import static com.openframe.client.config.AgentBinaryPolicyMode.ENFORCE;
import static com.openframe.client.config.AgentBinaryPolicyMode.LOG_ONLY;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentBinaryChecksumValidatorTest {

    private static final String VERSION = "1.5.74";
    private static final String MAC_OS = "MAC_OS";
    private static final String WINDOWS = "WINDOWS";
    private static final String MAC_SHA256 = "ccb156415a8ae80b5a3b8eacc7ebd281f0468e32676a4d1dfb66f887eea4cb9f";
    private static final String WINDOWS_SHA256 = "f6b77bf23ea98912db45724da35829f8b0a9344cf08c8afac31647368fe17df8";

    @Mock
    private ReleaseChecksumCatalog releaseChecksumCatalog;

    private AgentBinaryPolicyProperties policy;
    private AgentBinaryChecksumValidator validator;

    @BeforeEach
    void setUp() {
        policy = new AgentBinaryPolicyProperties();
        policy.setMode(ENFORCE);
        validator = new AgentBinaryChecksumValidator(policy, releaseChecksumCatalog);
    }

    @Test
    void validate_WithPublishedChecksum_Passes() {
        givenPublishedRelease();
        AgentRegistrationRequest request = request(MAC_OS, MAC_SHA256);

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_WithUppercaseChecksum_Passes() {
        givenPublishedRelease();
        String uppercaseSha256 = MAC_SHA256.toUpperCase();
        AgentRegistrationRequest request = request(MAC_OS, uppercaseSha256);

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_WithModifiedBinary_Throws() {
        givenPublishedRelease();
        AgentRegistrationRequest request = request(MAC_OS, "0".repeat(64));

        UntrustedAgentBinaryException ex = assertThrows(
                UntrustedAgentBinaryException.class,
                () -> validator.validate(request)
        );
        assertEquals(ErrorCode.AGENT_BINARY_UNTRUSTED, ex.getErrorCode());
    }

    @Test
    void validate_WithChecksumOfOtherOs_Throws() {
        givenPublishedRelease();
        AgentRegistrationRequest request = request(MAC_OS, WINDOWS_SHA256);

        assertThrows(UntrustedAgentBinaryException.class, () -> validator.validate(request));
    }

    @Test
    void validate_WithOsMissingFromRelease_Throws() {
        ReleaseBinaryChecksums checksums = new ReleaseBinaryChecksums();
        checksums.setBinaries(Map.of(WINDOWS, WINDOWS_SHA256));
        ReleaseChecksumLookup lookup = ReleaseChecksumLookup.found(checksums);
        when(releaseChecksumCatalog.lookup(VERSION)).thenReturn(lookup);
        AgentRegistrationRequest request = request(MAC_OS, MAC_SHA256);

        assertThrows(UntrustedAgentBinaryException.class, () -> validator.validate(request));
    }

    @Test
    void validate_WithUnpublishedVersion_Throws() {
        ReleaseChecksumLookup lookup = ReleaseChecksumLookup.notPublished();
        when(releaseChecksumCatalog.lookup(VERSION)).thenReturn(lookup);
        AgentRegistrationRequest request = request(MAC_OS, MAC_SHA256);

        assertThrows(UntrustedAgentBinaryException.class, () -> validator.validate(request));
    }

    @Test
    void validate_WithoutChecksumFromOlderAgent_ThrowsWithoutLookup() {
        AgentRegistrationRequest request = request(MAC_OS, null);

        assertThrows(UntrustedAgentBinaryException.class, () -> validator.validate(request));
        verify(releaseChecksumCatalog, never()).lookup(any());
    }

    @Test
    void validate_WhenReleasesUnavailable_AllowsAgent() {
        ReleaseChecksumLookup lookup = ReleaseChecksumLookup.unavailable();
        when(releaseChecksumCatalog.lookup(VERSION)).thenReturn(lookup);
        AgentRegistrationRequest request = request(MAC_OS, "0".repeat(64));

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_InLogOnlyMode_AllowsModifiedBinary() {
        policy.setMode(LOG_ONLY);
        givenPublishedRelease();
        AgentRegistrationRequest request = request(MAC_OS, "0".repeat(64));

        assertDoesNotThrow(() -> validator.validate(request));
    }

    @Test
    void validate_WhenDisabled_SkipsLookup() {
        policy.setMode(DISABLED);
        AgentRegistrationRequest request = request(MAC_OS, null);

        assertDoesNotThrow(() -> validator.validate(request));
        verify(releaseChecksumCatalog, never()).lookup(any());
    }

    private void givenPublishedRelease() {
        ReleaseBinaryChecksums checksums = new ReleaseBinaryChecksums();
        checksums.setVersion(VERSION);
        checksums.setBinaries(Map.of(MAC_OS, MAC_SHA256, WINDOWS, WINDOWS_SHA256));
        ReleaseChecksumLookup lookup = ReleaseChecksumLookup.found(checksums);
        when(releaseChecksumCatalog.lookup(VERSION)).thenReturn(lookup);
    }

    private static AgentRegistrationRequest request(String osType, String binarySha256) {
        AgentRegistrationRequest request = new AgentRegistrationRequest();
        request.setHostname("host");
        request.setOrganizationId("org-1");
        request.setAgentVersion(VERSION);
        request.setOsType(osType);
        request.setBinarySha256(binarySha256);
        return request;
    }
}
