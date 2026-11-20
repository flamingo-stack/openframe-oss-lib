package com.openframe.client.service.validator;

import com.openframe.client.exception.AgentRegistrationSecretValidationErrorException;
import com.openframe.client.exception.AgentRegistrationSecretValidationException;
import com.openframe.client.support.TestEncryption;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.agent.AgentRegistrationSecret;
import com.openframe.data.repository.agent.AgentRegistrationSecretRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static com.openframe.core.crypto.service.SecretPurpose.AGENT_LOG_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.AGENT_REGISTRATION_SECRET;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgentRegistrationSecretValidatorTest {

    private static final String TENANT = TestEncryption.TENANT;
    private static final EncryptionContext SECRET_CONTEXT = EncryptionContext.forTenant(TENANT, AGENT_REGISTRATION_SECRET);
    private static final String SECRET = "expected-secret";

    private final EncryptionService encryptionService = TestEncryption.SERVICE;
    private final AgentRegistrationSecretRepository secretRepository = mock(AgentRegistrationSecretRepository.class);
    private AgentRegistrationSecretValidator validator;

    @BeforeEach
    void setUp() {
        validator = new AgentRegistrationSecretValidator(secretRepository, encryptionService, TestEncryption.tenant());
    }

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
    }

    @Test
    void sameLengthWrongKeyIsRejected() {
        givenActive(encryptionService.encrypt(SECRET, SECRET_CONTEXT));

        AgentRegistrationSecretValidationException ex =
                assertThrows(AgentRegistrationSecretValidationException.class, () -> validator.validate("expected-Secret"));

        assertEquals(ErrorCode.INITIAL_KEY_INVALID, ex.getErrorCode());
    }

    @Test
    void keyDifferingOnlyInLengthIsRejected() {
        givenActive(encryptionService.encrypt(SECRET, SECRET_CONTEXT));

        AgentRegistrationSecretValidationException ex =
                assertThrows(AgentRegistrationSecretValidationException.class, () -> validator.validate(SECRET + "x"));

        assertEquals(ErrorCode.INITIAL_KEY_INVALID, ex.getErrorCode());
    }

    @Test
    void equalKeyInAnotherInstancePasses() {
        givenActive(encryptionService.encrypt(SECRET, SECRET_CONTEXT));

        assertDoesNotThrow(() -> validator.validate(new String(SECRET)));
    }

    @Test
    void activeSecretEncryptedForThePodTenantAndRegistrationPurposeIsAccepted() {
        givenActive(encryptionService.encrypt(SECRET, SECRET_CONTEXT));

        assertThatCode(() -> validator.validate(SECRET)).doesNotThrowAnyException();
    }

    @Test
    void secretEncryptedForAnotherTenantIsRejectedEvenWithTheRightKey() {
        givenActive(encryptionService.encrypt(SECRET, EncryptionContext.forTenant("tenant-2", AGENT_REGISTRATION_SECRET)));

        assertThatThrownBy(() -> validator.validate(SECRET))
                .isInstanceOfAny(EncryptionException.class, AgentRegistrationSecretValidationException.class,
                        AgentRegistrationSecretValidationErrorException.class);
    }

    @Test
    void secretEncryptedForAnotherPurposeIsRejectedEvenWithTheRightKey() {
        givenActive(encryptionService.encrypt(SECRET, EncryptionContext.forTenant(TENANT, AGENT_LOG_KEY)));

        assertThatThrownBy(() -> validator.validate(SECRET))
                .isInstanceOfAny(EncryptionException.class, AgentRegistrationSecretValidationException.class,
                        AgentRegistrationSecretValidationErrorException.class);
    }

    @Test
    void afterRotationTheNewKeyIsAcceptedAndTheOldOneRejected() {
        givenActive(encryptionService.encrypt("old-key", SECRET_CONTEXT));
        assertThatCode(() -> validator.validate("old-key")).doesNotThrowAnyException();

        // rotation: the repository now returns the new active secret, the old one is inactive
        givenActive(encryptionService.encrypt("new-key", SECRET_CONTEXT));

        assertThatCode(() -> validator.validate("new-key")).doesNotThrowAnyException();
        AgentRegistrationSecretValidationException ex =
                assertThrows(AgentRegistrationSecretValidationException.class, () -> validator.validate("old-key"));
        assertEquals(ErrorCode.INITIAL_KEY_INVALID, ex.getErrorCode());
    }

    private void givenActive(String encryptedKey) {
        AgentRegistrationSecret secret = new AgentRegistrationSecret();
        secret.setTenantId(TENANT);
        secret.setSecretKey(encryptedKey);
        secret.setActive(true);
        when(secretRepository.findByActiveTrue()).thenReturn(Optional.of(secret));
    }
}
