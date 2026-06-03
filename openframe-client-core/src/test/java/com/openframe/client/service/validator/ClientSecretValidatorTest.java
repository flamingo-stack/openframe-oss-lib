package com.openframe.client.service.validator;

import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.oauth.OAuthClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientSecretValidatorTest {

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private ClientSecretValidator validator;

    private static final String RAW_SECRET = "raw-secret";
    private static final String ENCODED_SECRET = "encoded-secret";

    @Test
    void validate_WithMatchingSecret_Passes() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);
        when(passwordEncoder.matches(RAW_SECRET, ENCODED_SECRET)).thenReturn(true);

        assertDoesNotThrow(() -> validator.validate(client, RAW_SECRET));
    }

    @Test
    void validate_WithBlankSecret_ThrowsEmpty() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);

        InvalidClientSecretException ex = assertThrows(
                InvalidClientSecretException.class,
                () -> validator.validate(client, "   ")
        );
        assertEquals(ErrorCode.CLIENT_SECRET_EMPTY, ex.getErrorCode());
        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void validate_WithWrongSecret_ThrowsInvalid() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);
        when(passwordEncoder.matches(RAW_SECRET, ENCODED_SECRET)).thenReturn(false);

        InvalidClientSecretException ex = assertThrows(
                InvalidClientSecretException.class,
                () -> validator.validate(client, RAW_SECRET)
        );
        assertEquals(ErrorCode.CLIENT_SECRET_INVALID, ex.getErrorCode());
    }

    private OAuthClient clientWithSecret(String encodedSecret) {
        OAuthClient client = new OAuthClient();
        client.setClientSecret(encodedSecret);
        return client;
    }
}
