package com.openframe.client.service.validator;

import com.openframe.audit.AuditRecorder;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.model.audit.AuditEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Map;

import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_EMPTY;
import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;
import static org.springframework.util.StringUtils.hasText;

@Component
@RequiredArgsConstructor
public class ClientSecretValidator {

    private final PasswordEncoder passwordEncoder;
    private final AuditRecorder auditRecorder;

    public void validate(OAuthClient client, String clientSecret, String route) {
        try {
            requireMatchingSecret(client, clientSecret);
        } catch (InvalidClientSecretException e) {
            String machineId = client.getMachineId();
            auditRecorder.recordOnce(AuditEntry.builder()
                    .action(DEVICE_AUTH_FAIL)
                    .targetId(machineId)
                    .details(Map.of("request", route)), e, route + ":" + machineId);
            throw e;
        }
    }

    private void requireMatchingSecret(OAuthClient client, String clientSecret) {
        if (!hasText(clientSecret)) {
            throw new InvalidClientSecretException(CLIENT_SECRET_EMPTY, "Client secret is empty");
        }

        String encodedSecret = client.getClientSecret();
        if (!passwordEncoder.matches(clientSecret, encodedSecret)) {
            throw new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret");
        }
    }
}
