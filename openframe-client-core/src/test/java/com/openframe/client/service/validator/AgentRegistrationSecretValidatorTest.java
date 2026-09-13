package com.openframe.client.service.validator;

import com.openframe.client.exception.AgentRegistrationSecretValidationErrorException;
import com.openframe.client.exception.AgentRegistrationSecretValidationException;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.agent.AgentRegistrationSecret;
import com.openframe.data.repository.agent.AgentRegistrationSecretRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentRegistrationSecretValidatorTest {

    private static final String ENCRYPTED = "encrypted";
    private static final String SECRET = "expected-secret";

    @Mock
    private AgentRegistrationSecretRepository secretRepository;

    @Mock
    private EncryptionService encryptionService;

    @InjectMocks
    private AgentRegistrationSecretValidator validator;

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void blankKeyIsRejectedBeforeAnyLookup(String initialKey) {
        AgentRegistrationSecretValidationException ex =
                assertThrows(AgentRegistrationSecretValidationException.class, () -> validator.validate(initialKey));

        assertEquals(ErrorCode.INITIAL_KEY_EMPTY, ex.getErrorCode());
        verify(secretRepository, never()).findByActiveTrue();
    }

    @Test
    void missingActiveSecretIsAnError() {
        when(secretRepository.findByActiveTrue()).thenReturn(Optional.empty());

        assertThrows(AgentRegistrationSecretValidationErrorException.class, () -> validator.validate(SECRET));
        verify(encryptionService, never()).decrypt(any());
    }

    @Test
    void sameLengthWrongKeyIsRejected() {
        stubActiveSecret();

        AgentRegistrationSecretValidationException ex =
                assertThrows(AgentRegistrationSecretValidationException.class, () -> validator.validate("expected-Secret"));

        assertEquals(ErrorCode.INITIAL_KEY_INVALID, ex.getErrorCode());
    }

    @Test
    void keyDifferingOnlyInLengthIsRejected() {
        stubActiveSecret();

        AgentRegistrationSecretValidationException ex =
                assertThrows(AgentRegistrationSecretValidationException.class, () -> validator.validate(SECRET + "x"));

        assertEquals(ErrorCode.INITIAL_KEY_INVALID, ex.getErrorCode());
    }

    @Test
    void equalKeyInAnotherInstancePasses() {
        stubActiveSecret();

        assertDoesNotThrow(() -> validator.validate(new String(SECRET)));
    }

    private void stubActiveSecret() {
        AgentRegistrationSecret secret = new AgentRegistrationSecret();
        secret.setSecretKey(ENCRYPTED);
        when(secretRepository.findByActiveTrue()).thenReturn(Optional.of(secret));
        when(encryptionService.decrypt(ENCRYPTED)).thenReturn(SECRET);
    }
}
