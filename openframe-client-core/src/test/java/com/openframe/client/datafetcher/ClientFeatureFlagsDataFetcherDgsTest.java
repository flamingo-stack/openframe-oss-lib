package com.openframe.client.datafetcher;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@SpringBootTest(
        classes = ClientFeatureFlagsDataFetcherDgsTest.ClientFeatureFlagsGraphQlApp.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ClientFeatureFlagsDataFetcherDgsTest {

    private static final String QUERY = "{ clientFeatureFlags { name enabled minVersion } }";

    @MockitoBean
    private OpenFrameClientConfigurationService openFrameClientConfigurationService;

    @Autowired
    private DgsQueryExecutor dgsQueryExecutor;

    @Test
    void clientFeatureFlags_returnsEveryFlagWithItsNameAndMinVersion() {
        ClientFeatureFlag flag = new ClientFeatureFlag(true, "1.6.0");
        when(openFrameClientConfigurationService.getFeatureFlags()).thenReturn(Map.of("package-auto-update", flag));

        List<Map<String, Object>> flags = dgsQueryExecutor.executeAndExtractJsonPath(QUERY, "data.clientFeatureFlags");

        assertThat(flags).containsExactly(
                Map.of("name", "package-auto-update", "enabled", true, "minVersion", "1.6.0"));
    }

    @Test
    void clientFeatureFlags_withNoFlags_returnsAnEmptyList() {
        when(openFrameClientConfigurationService.getFeatureFlags()).thenReturn(Map.of());

        List<Map<String, Object>> flags = dgsQueryExecutor.executeAndExtractJsonPath(QUERY, "data.clientFeatureFlags");

        assertThat(flags).isEmpty();
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({GraphQlAutoConfiguration.class, DgsSpringGraphQLAutoConfiguration.class})
    @Import(ClientFeatureFlagsDataFetcher.class)
    static class ClientFeatureFlagsGraphQlApp {
    }
}
