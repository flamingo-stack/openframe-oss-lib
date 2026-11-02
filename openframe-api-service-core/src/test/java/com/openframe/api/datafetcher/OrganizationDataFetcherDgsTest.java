package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.openframe.api.config.DateScalarConfig;
import com.openframe.api.config.InstantScalarConfig;
import com.openframe.api.config.JsonScalarConfig;
import com.openframe.api.config.LongScalarConfig;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.GraphQLExceptionHandler;
import com.openframe.api.mapper.GraphQLOrganizationMapper;
import com.openframe.api.service.organization.OrganizationQueryService;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.service.OrganizationService;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import graphql.ExecutionResult;
import graphql.GraphQLError;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.validation.autoconfigure.ValidationAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@SpringBootTest(
        classes = OrganizationDataFetcherDgsTest.OrganizationsGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "dgs.graphql.schema-locations=classpath:schema/shared.graphqls,classpath:schema/organization.graphqls,classpath:test-schema/test-bridge.graphqls")
class OrganizationDataFetcherDgsTest {

    private static final String ORGANIZATIONS_BY_STATUS = """
            { organizations(filter: { status: "%s" }) { edges { node { organizationId } } filteredCount } }
            """;

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @MockitoBean
    private OrganizationService organizationService;

    @MockitoBean
    private OrganizationQueryService organizationQueryService;

    @ParameterizedTest
    @ValueSource(strings = {"ACTIVE", "ARCHIVED"})
    void organizations_knownStatusFilter_reachesTheQueryService(String status) {
        // setup
        OrganizationFilterOptions byStatus = OrganizationFilterOptions.builder().status(status).build();
        CountedGenericQueryResult<Organization> empty = CountedGenericQueryResult.<Organization>builder()
                .items(List.of()).pageInfo(PageInfo.builder().build()).filteredCount(0).build();
        when(organizationQueryService.queryOrganizations(eq(byStatus), any(), isNull(), any())).thenReturn(empty);
        String query = ORGANIZATIONS_BY_STATUS.formatted(status);

        // execution
        ExecutionResult result = queryExecutor.execute(query);

        // verifications
        assertThat(result.getErrors()).isEmpty();
        assertThat(result.<Map<String, Object>>getData())
                .containsEntry("organizations", Map.of("edges", List.of(), "filteredCount", 0));
        verify(organizationQueryService).queryOrganizations(eq(byStatus), any(), isNull(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"DELETED", "archived", "FOO", ""})
    void organizations_unknownStatusFilter_refusedAsValidationErrorWithoutEdges(String status) {
        // setup
        String query = ORGANIZATIONS_BY_STATUS.formatted(status);

        // execution
        ExecutionResult result = queryExecutor.execute(query);

        // verifications
        assertThat(result.getErrors())
                .extracting(error -> error.getExtensions().get("code"), error -> error.getExtensions().get("httpStatus"))
                .containsExactly(tuple("VALIDATION_ERROR", 400));
        assertThat(result.getErrors())
                .extracting(GraphQLError::getMessage)
                .allSatisfy(message -> assertThat(message).contains("status must be ACTIVE or ARCHIVED"));
        assertThat(result.<Map<String, Object>>getData()).containsEntry("organizations", null);
        verifyNoInteractions(organizationQueryService);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({GraphQlAutoConfiguration.class, DgsSpringGraphQLAutoConfiguration.class,
            RelayAutoConfiguration.class, ValidationAutoConfiguration.class})
    @Import({OrganizationDataFetcher.class, GraphQLOrganizationMapper.class, GraphQLExceptionHandler.class,
            InstantScalarConfig.class, DateScalarConfig.class, LongScalarConfig.class, JsonScalarConfig.class})
    static class OrganizationsGraphQlApp {
    }
}
