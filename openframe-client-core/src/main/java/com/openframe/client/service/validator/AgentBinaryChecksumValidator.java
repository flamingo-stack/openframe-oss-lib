package com.openframe.client.service.validator;

import com.openframe.client.config.AgentBinaryPolicyProperties;
import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.exception.UntrustedAgentBinaryException;
import com.openframe.client.service.release.ReleaseChecksumCatalog;
import com.openframe.client.service.release.model.ReleaseChecksumLookup;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

import static com.openframe.client.config.AgentBinaryPolicyMode.DISABLED;
import static com.openframe.client.config.AgentBinaryPolicyMode.LOG_ONLY;
import static java.lang.String.format;
import static org.springframework.util.StringUtils.hasText;

// The agent reports its own checksum, so this stops rebuilt, patched and unreleased builds, not a client crafted to lie
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentBinaryChecksumValidator {

    private static final String UNTRUSTED_BINARY_MESSAGE =
            "Agent %s (version %s, osType %s, organization %s, sha256 %s) is not a published release: %s";
    private static final String NO_CHECKSUM_REASON = "no binary checksum reported";
    private static final String NOT_PUBLISHED_REASON = "version has no published checksums";
    private static final String MISMATCH_REASON = "checksum does not match the release";

    private final AgentBinaryPolicyProperties policy;
    private final ReleaseChecksumCatalog releaseChecksumCatalog;

    public void validate(AgentRegistrationRequest request) {
        if (isPolicyDisabled()) {
            return;
        }
        String reportedSha256 = request.getBinarySha256();
        if (!hasText(reportedSha256)) {
            rejectUntrusted(request, NO_CHECKSUM_REASON);
            return;
        }

        String version = request.getAgentVersion();
        ReleaseChecksumLookup lookup = releaseChecksumCatalog.lookup(version);
        switch (lookup.getStatus()) {
            case FOUND -> verifyChecksum(request, lookup);
            case NOT_PUBLISHED -> rejectUntrusted(request, NOT_PUBLISHED_REASON);
            // GitHub being down must not stop installs; the agent is checked again on its next registration
            case UNAVAILABLE -> log.warn("Release checksums for version {} are unavailable, allowing agent {} unverified",
                    version, request.getHostname());
        }
    }

    private boolean isPolicyDisabled() {
        return policy.getMode() == DISABLED;
    }

    private void verifyChecksum(AgentRegistrationRequest request, ReleaseChecksumLookup lookup) {
        Map<String, String> binaries = lookup.getBinaries();
        String osType = request.getOsType();
        String expectedSha256 = binaries.get(osType);
        String reportedSha256 = request.getBinarySha256();
        if (isSameChecksum(reportedSha256, expectedSha256)) {
            log.debug("Agent {} matches the published {} binary of version {}",
                    request.getHostname(), osType, request.getAgentVersion());
            return;
        }
        rejectUntrusted(request, MISMATCH_REASON);
    }

    private static boolean isSameChecksum(String reportedSha256, String expectedSha256) {
        return reportedSha256.equalsIgnoreCase(expectedSha256);
    }

    private void rejectUntrusted(AgentRegistrationRequest request, String reason) {
        String hostname = request.getHostname();
        String version = request.getAgentVersion();
        String osType = request.getOsType();
        String organizationId = request.getOrganizationId();
        String reportedSha256 = request.getBinarySha256();
        String message = format(UNTRUSTED_BINARY_MESSAGE, hostname, version, osType, organizationId, reportedSha256, reason);
        if (isLogOnly()) {
            log.warn("{}; allowed because policy mode is {}", message, LOG_ONLY);
            return;
        }
        throw new UntrustedAgentBinaryException(message);
    }

    private boolean isLogOnly() {
        return policy.getMode() == LOG_ONLY;
    }
}
