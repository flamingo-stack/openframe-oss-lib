package com.openframe.api.exception;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.autoconfig.DgsAutoConfiguration;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@SpringBootTest(
        classes = GraphQLExceptionHandlerDgsTest.RoleCheckedGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:test-schema/role-checked.graphqls")
class GraphQLExceptionHandlerDgsTest {

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void handleException_callerWithoutTheRole_answersForbidden() {
        signIn("AGENT");

        ExecutionResult result = queryExecutor.execute("{ adminOnly }");

        assertThat(result.getErrors())
                .extracting(GraphQLError::getMessage, error -> error.getExtensions().get("code"),
                        error -> error.getExtensions().get("httpStatus"))
                .containsExactly(tuple("Access denied", "FORBIDDEN", 403));
    }

    @Test
    void handleException_anonymousCaller_answersUnauthorized() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken("key", "anonymousUser",
                AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));

        ExecutionResult result = queryExecutor.execute("{ adminOnly }");

        assertThat(result.getErrors())
                .extracting(GraphQLError::getMessage, error -> error.getExtensions().get("code"),
                        error -> error.getExtensions().get("httpStatus"))
                .containsExactly(tuple("Access denied", "UNAUTHORIZED", 401));
    }

    @Test
    void handleException_callerWithTheRole_isAnswered() {
        signIn("ADMIN");

        ExecutionResult result = queryExecutor.execute("{ adminOnly }");

        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData()).containsEntry("adminOnly", "granted");
    }

    private static void signIn(String role) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("caller-1")
                .claim("roles", List.of(role))
                .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList(role)));
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration(DgsAutoConfiguration.class)
    @EnableMethodSecurity
    @Import({GraphQLExceptionHandler.class, AdminOnlyDataFetcher.class})
    static class RoleCheckedGraphQlApp {
    }

    @DgsComponent
    static class AdminOnlyDataFetcher {

        @DgsQuery
        @PreAuthorize("hasAuthority('ADMIN')")
        String adminOnly() {
            return "granted";
        }
    }
}
