package com.openframe.authz.service.auth;

import com.openframe.authz.dto.AuthErrorDetail;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static com.openframe.core.exception.AuthErrorCode.PROVIDER_ERROR;
import static com.openframe.core.exception.AuthErrorCode.SSO_SESSION_EXPIRED;
import static com.openframe.core.exception.AuthErrorCode.UNEXPECTED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthErrorMessageResolverTest {

    private static final String REFERENCE = "7KQ2M9XD";

    @Mock
    private AuthErrorDetailStore detailStore;

    @InjectMocks
    private AuthErrorMessageResolver resolver;

    @Test
    void shouldAnswerCatalogCodeWithItsMessageWithoutTouchingTheStore() {
        AuthErrorDetail detail = resolver.resolve("SSO_SESSION_EXPIRED");

        assertThat(detail.getCode()).isEqualTo(SSO_SESSION_EXPIRED);
        assertThat(detail.getMessage()).isEqualTo("SSO session expired. Please try again.");
        verifyNoInteractions(detailStore);
    }

    @Test
    void shouldAnswerStoredReferenceWithTheStoredDetail() {
        AuthErrorDetail stored = new AuthErrorDetail(PROVIDER_ERROR, "AADSTS50020: User account does not exist");
        when(detailStore.find(REFERENCE)).thenReturn(Optional.of(stored));

        assertThat(resolver.resolve(REFERENCE)).isSameAs(stored);
    }

    @Test
    void shouldAnswerExpiredReferenceWithTheGenericMessage() {
        when(detailStore.find(REFERENCE)).thenReturn(Optional.empty());

        AuthErrorDetail detail = resolver.resolve(REFERENCE);

        assertThat(detail.getCode()).isEqualTo(UNEXPECTED);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "7kq2m9xd", "7KQ2M9X0", "../etc/passwd", "sso_session_expired",
            "Your account is suspended. Call +1-555-0100"})
    void shouldAnswerAnythingElseWithTheGenericMessageWithoutTouchingTheStore(String reference) {
        AuthErrorDetail detail = resolver.resolve(reference);

        assertThat(detail.getCode()).isEqualTo(UNEXPECTED);
        assertThat(detail.getMessage())
                .isEqualTo("An unexpected error occurred. Please try again or contact support if the problem persists.");
        verifyNoInteractions(detailStore);
    }
}
