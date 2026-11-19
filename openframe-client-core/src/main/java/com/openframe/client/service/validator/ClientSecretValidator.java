package com.openframe.client.service.validator;

import com.openframe.audit.Audited;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.data.document.oauth.OAuthClient;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_EMPTY;
import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;
import static org.springframework.util.StringUtils.hasText;

@Component
@RequiredArgsConstructor
public class ClientSecretValidator {

    private final PasswordEncoder passwordEncoder;

    @Audited(action = DEVICE_AUTH_FAIL, targetId = "#client.machineId", condition = "false")
    public void validate(OAuthClient client, String clientSecret) {
        if (!hasText(clientSecret)) {
            throw new InvalidClientSecretException(CLIENT_SECRET_EMPTY, "Client secret is empty");
        }

        String encodedSecret = client.getClientSecret();
        if (!passwordEncoder.matches(clientSecret, encodedSecret)) {
            throw new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret");
        }
    }
}
