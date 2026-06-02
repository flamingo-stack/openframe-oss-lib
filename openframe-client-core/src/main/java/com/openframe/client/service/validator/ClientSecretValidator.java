package com.openframe.client.service.validator;

import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_EMPTY;
import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static org.springframework.util.StringUtils.hasText;

@Component
@RequiredArgsConstructor
public class ClientSecretValidator {

    private final OAuthClientRepository oauthClientRepository;
    private final PasswordEncoder passwordEncoder;

    public OAuthClient validate(String machineId, String clientSecret) {
        OAuthClient client = oauthClientRepository.findByMachineId(machineId)
                .orElseThrow(() -> new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Unknown machine: " + machineId));

        if (!hasText(clientSecret)) {
            throw new InvalidClientSecretException(CLIENT_SECRET_EMPTY, "Client secret is empty");
        }

        String encodedSecret = client.getClientSecret();
        if (!passwordEncoder.matches(clientSecret, encodedSecret)) {
            throw new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret");
        }

        return client;
    }
}
