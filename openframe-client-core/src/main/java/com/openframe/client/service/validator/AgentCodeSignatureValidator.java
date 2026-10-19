package com.openframe.client.service.validator;

import com.openframe.client.config.AgentCodeSignaturePolicyProperties;
import com.openframe.client.dto.agent.AgentCodeSignature;
import com.openframe.client.dto.agent.AgentRegistrationRequest;
import com.openframe.client.exception.UntrustedAgentSignatureException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.openframe.client.config.CodeSignaturePolicyMode.DISABLED;
import static com.openframe.client.config.CodeSignaturePolicyMode.LOG_ONLY;
import static com.openframe.client.dto.agent.CodeSignatureStatus.VALID;
import static java.lang.String.format;
import static org.springframework.util.CollectionUtils.isEmpty;

// The agent reports its own signature, so this stops repackaged or patched builds, not a client crafted to lie
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentCodeSignatureValidator {

    private static final String UNTRUSTED_SIGNATURE_MESSAGE =
            "Agent %s (osType %s, organization %s) is not signed by a trusted signer: %s";

    private final AgentCodeSignaturePolicyProperties policy;

    public void validate(AgentRegistrationRequest request) {
        if (isPolicyDisabled()) {
            return;
        }

        String osType = request.getOsType();
        List<String> trustedSigners = policy.trustedSignersFor(osType);
        if (isEmpty(trustedSigners)) {
            log.debug("No trusted signers configured for osType {}, skipping code signature check", osType);
            return;
        }

        AgentCodeSignature signature = request.getCodeSignature();
        if (isSignedByTrustedSigner(signature, trustedSigners)) {
            log.debug("Agent {} signed by trusted signer {}", request.getHostname(), signature.getSigner());
            return;
        }

        rejectUntrustedSignature(request);
    }

    private boolean isPolicyDisabled() {
        return policy.getMode() == DISABLED;
    }

    private boolean isSignedByTrustedSigner(AgentCodeSignature signature, List<String> trustedSigners) {
        return signature != null
                && signature.getStatus() == VALID
                && trustedSigners.contains(signature.getSigner());
    }

    private void rejectUntrustedSignature(AgentRegistrationRequest request) {
        String hostname = request.getHostname();
        String osType = request.getOsType();
        String organizationId = request.getOrganizationId();
        AgentCodeSignature signature = request.getCodeSignature();
        String message = format(UNTRUSTED_SIGNATURE_MESSAGE, hostname, osType, organizationId, signature);
        if (isLogOnly()) {
            log.warn("{}; allowed because policy mode is {}", message, LOG_ONLY);
            return;
        }
        throw new UntrustedAgentSignatureException(message);
    }

    private boolean isLogOnly() {
        return policy.getMode() == LOG_ONLY;
    }
}
