package com.openframe.client.service.validator;

import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientSecretValidatorTest {

    @Mock
    private OAuthClientRepository oauthClientRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private ClientSecretValidator validator;

    private static final String MACHINE_ID = "m-1";
    private static final String RAW_SECRET = "raw-secret";
    private static final String ENCODED_SECRET = "encoded-secret";

    @Test
    void validate_WithMatchingSecret_ReturnsClient() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(client));
        when(passwordEncoder.matches(RAW_SECRET, ENCODED_SECRET)).thenReturn(true);

        OAuthClient result = validator.validate(MACHINE_ID, RAW_SECRET);

        assertSame(client, result);
    }

    @Test
    void validate_WithUnknownMachine_ThrowsInvalid() {
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        InvalidClientSecretException ex = assertThrows(
                InvalidClientSecretException.class,
                () -> validator.validate(MACHINE_ID, RAW_SECRET)
        );
        assertEquals(ErrorCode.CLIENT_SECRET_INVALID, ex.getErrorCode());
        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void validate_WithBlankSecret_ThrowsEmpty() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(client));

        InvalidClientSecretException ex = assertThrows(
                InvalidClientSecretException.class,
                () -> validator.validate(MACHINE_ID, "   ")
        );
        assertEquals(ErrorCode.CLIENT_SECRET_EMPTY, ex.getErrorCode());
        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void validate_WithWrongSecret_ThrowsInvalid() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(client));
        when(passwordEncoder.matches(RAW_SECRET, ENCODED_SECRET)).thenReturn(false);

        InvalidClientSecretException ex = assertThrows(
                InvalidClientSecretException.class,
                () -> validator.validate(MACHINE_ID, RAW_SECRET)
        );
        assertEquals(ErrorCode.CLIENT_SECRET_INVALID, ex.getErrorCode());
    }

    private OAuthClient clientWithSecret(String encodedSecret) {
        OAuthClient client = new OAuthClient();
        client.setMachineId(MACHINE_ID);
        client.setClientId("agent_" + MACHINE_ID);
        client.setClientSecret(encodedSecret);
        return client;
    }
}
