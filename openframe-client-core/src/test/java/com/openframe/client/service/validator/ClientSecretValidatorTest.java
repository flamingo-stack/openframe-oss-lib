package com.openframe.client.service.validator;

import com.openframe.audit.AuditRecorder;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.model.audit.AuditEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientSecretValidatorTest {

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuditRecorder auditRecorder;

    @InjectMocks
    private ClientSecretValidator validator;

    private static final String RAW_SECRET = "raw-secret";
    private static final String ENCODED_SECRET = "encoded-secret";
    private static final String MACHINE_ID = "mach-7";

    @Test
    void validate_WithMatchingSecret_Passes() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);
        when(passwordEncoder.matches(RAW_SECRET, ENCODED_SECRET)).thenReturn(true);

        assertDoesNotThrow(() -> validator.validate(client, RAW_SECRET, "uninstall"));
    }

    @Test
    void validate_WithBlankSecret_ThrowsEmpty() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);

        InvalidClientSecretException ex = assertThrows(
                InvalidClientSecretException.class,
                () -> validator.validate(client, "   ", "uninstall")
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
                () -> validator.validate(client, RAW_SECRET, "uninstall")
        );
        assertEquals(ErrorCode.CLIENT_SECRET_INVALID, ex.getErrorCode());
    }

    @Test
    void validate_wrongSecret_recordsTheRefusalOnTheDeviceOncePerRoute() {
        OAuthClient client = agentClient();
        when(passwordEncoder.matches(RAW_SECRET, ENCODED_SECRET)).thenReturn(false);

        Throwable thrown = catchThrowable(() -> validator.validate(client, RAW_SECRET, "uninstall"));

        ArgumentCaptor<AuditEntry.AuditEntryBuilder> entry = ArgumentCaptor.forClass(AuditEntry.AuditEntryBuilder.class);
        verify(auditRecorder).recordOnce(entry.capture(), same(thrown), eq("uninstall:mach-7"));
        assertThat(entry.getValue().build())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(DEVICE_AUTH_FAIL, MACHINE_ID, Map.of("request", "uninstall"));
    }

    @Test
    void validate_emptySecret_recordsTheRefusalToo() {
        OAuthClient client = agentClient();

        Throwable thrown = catchThrowable(() -> validator.validate(client, "", "reinstall"));

        verify(auditRecorder).recordOnce(any(AuditEntry.AuditEntryBuilder.class), same(thrown), eq("reinstall:mach-7"));
    }

    private OAuthClient clientWithSecret(String encodedSecret) {
        OAuthClient client = new OAuthClient();
        client.setClientSecret(encodedSecret);
        return client;
    }

    private OAuthClient agentClient() {
        OAuthClient client = clientWithSecret(ENCODED_SECRET);
        client.setMachineId(MACHINE_ID);
        return client;
    }
}
