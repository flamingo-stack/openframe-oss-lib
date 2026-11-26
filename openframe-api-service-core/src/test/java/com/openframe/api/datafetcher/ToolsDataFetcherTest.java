package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.mapper.GraphQLToolMapper;
import com.openframe.api.service.ToolService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.DataFetchingEnvironmentImpl;
import graphql.schema.DataFetchingFieldSelectionSet;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.GenericApplicationContext;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolsDataFetcherTest {

    @Mock private ToolService toolService;
    @Mock private GraphQLToolMapper toolMapper;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private DataFetchingFieldSelectionSet selection;
    @InjectMocks private ToolsDataFetcher dataFetcher;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    private final ToolCredentials credentials = usernameAndPassword();

    @Test
    void credentials_storedPasswordAsked_storesTheViewOfThePassword() {
        when(selection.contains(anyString())).thenReturn(false);
        when(selection.contains("password")).thenReturn(true);

        dataFetcher.credentials(toolField());

        AuditCall call = capturedCall();
        assertThat(call.storeIf().test(credentials)).isTrue();
        assertThat(call.detailsFromResult().apply(credentials)).containsOnly(entry("fields", List.of("password")));
    }

    @Test
    void credentials_noSecretPartAsked_storesNoView() {
        when(selection.contains(anyString())).thenReturn(false);

        dataFetcher.credentials(toolField());

        assertThat(capturedCall().storeIf().test(credentials)).isFalse();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private DgsDataFetchingEnvironment toolField() {
        IntegratedTool tool = new IntegratedTool();
        tool.setId("fleetmdm-server");
        tool.setCredentials(credentials);
        DataFetchingEnvironment environment = DataFetchingEnvironmentImpl.newDataFetchingEnvironment()
                .source(tool)
                .selectionSet(selection)
                .build();
        return new DgsDataFetchingEnvironment(environment, new GenericApplicationContext());
    }

    private static ToolCredentials usernameAndPassword() {
        ToolCredentials credentials = new ToolCredentials();
        credentials.setUsername("admin");
        credentials.setPassword("s3cret");
        return credentials;
    }
}
