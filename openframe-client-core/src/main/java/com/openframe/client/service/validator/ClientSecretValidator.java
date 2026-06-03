package com.openframe.client.service.validator;

import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.data.document.oauth.OAuthClient;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_EMPTY;
import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static org.springframework.util.StringUtils.hasText;

@Component
@RequiredArgsConstructor
public class ClientSecretValidator {

    private final PasswordEncoder passwordEncoder;

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
