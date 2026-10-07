package com.openframe.authz.datafetcher;

import com.openframe.authz.dto.AuthErrorDetail;
import com.openframe.authz.dto.AuthErrorMessage;
import com.openframe.authz.service.auth.AuthErrorMessageResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static com.openframe.core.exception.AuthErrorCode.PROVIDER_ERROR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthErrorMessageDataFetcherTest {

    private static final String REFERENCE = "7KQ2M9XD";
    private static final String PROVIDER_MESSAGE = "AADSTS50020: User account from identity provider does not exist";

    @Mock
    private AuthErrorMessageResolver resolver;

    @InjectMocks
    private AuthErrorMessageDataFetcher dataFetcher;

    @Test
    void shouldAnswerWithTheResolvedCodeNameAndMessage() {
        AuthErrorDetail resolved = new AuthErrorDetail(PROVIDER_ERROR, PROVIDER_MESSAGE);
        when(resolver.resolve(REFERENCE)).thenReturn(resolved);

        AuthErrorMessage message = dataFetcher.authErrorMessage(REFERENCE);

        assertThat(message)
                .extracting(AuthErrorMessage::getCode, AuthErrorMessage::getMessage)
                .containsExactly("PROVIDER_ERROR", PROVIDER_MESSAGE);
    }
}
