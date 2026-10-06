package com.openframe.authz.datafetcher;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.openframe.authz.dto.AuthErrorDetail;
import com.openframe.authz.service.auth.AuthErrorMessageResolver;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static com.openframe.core.exception.AuthErrorCode.PROVIDER_ERROR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** Boots only the DGS schema and this data fetcher, so auth-error.graphqls and the query wiring are proven to agree. */
@SpringBootTest(classes = AuthErrorMessageQueryContextTest.AuthErrorGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class AuthErrorMessageQueryContextTest {

    private static final String REFERENCE = "7KQ2M9XD";
    private static final String PROVIDER_MESSAGE = "AADSTS50020: User account from identity provider does not exist";

    @MockitoBean
    private AuthErrorMessageResolver resolver;

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Test
    void shouldServeTheQueryThroughTheSchema() {
        AuthErrorDetail resolved = new AuthErrorDetail(PROVIDER_ERROR, PROVIDER_MESSAGE);
        when(resolver.resolve(REFERENCE)).thenReturn(resolved);
        String query = "{ authErrorMessage(reference: \"7KQ2M9XD\") { code message } }";

        String message = queryExecutor.executeAndExtractJsonPath(query, "data.authErrorMessage.message");

        assertThat(message).isEqualTo(PROVIDER_MESSAGE);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({GraphQlAutoConfiguration.class, DgsSpringGraphQLAutoConfiguration.class})
    @Import(AuthErrorMessageDataFetcher.class)
    static class AuthErrorGraphQlApp {
    }
}
