package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dto.tool.ToolFilterInput;
import com.openframe.api.dto.tool.ToolFilterCriteria;
import com.openframe.api.dto.tool.ToolFilters;
import com.openframe.api.dto.tool.ToolList;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLToolMapper;
import com.openframe.api.service.ToolService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.targets.ToolCredentialParts;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import graphql.schema.DataFetchingFieldSelectionSet;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.TOOL_CREDENTIALS_VIEW;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ToolsDataFetcher {

    private final ToolService toolService;
    private final GraphQLToolMapper toolMapper;
    private final AuditedMethodRunner auditedMethodRunner;

    @DgsQuery
    public ToolList integratedTools(
            @InputArgument @Valid ToolFilterInput filter,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {

        log.debug("Getting integrated tools with filter: {}, search: {}, sort: {}", filter, search, sort);

        ToolFilterCriteria filterOptions = toolMapper.toToolFilterCriteria(filter);
        return toolService.queryTools(filterOptions, search, sort);
    }

    @DgsData(parentType = "IntegratedTool", field = "credentials")
    public ToolCredentials credentials(DgsDataFetchingEnvironment dfe) {
        IntegratedTool tool = dfe.getSource();
        ToolCredentials credentials = tool.getCredentials();
        DataFetchingFieldSelectionSet selection = dfe.getSelectionSet();
        List<String> sentParts = ToolCredentialParts.sent(credentials, selection::contains);
        AuditCall auditCall = AuditCall.of(TOOL_CREDENTIALS_VIEW, tool.getId(), Map.of("fields", sentParts))
                .withStoreIf(_ -> !sentParts.isEmpty());
        return auditedMethodRunner.run(auditCall, () -> credentials);
    }

    @DgsQuery
    public ToolFilters toolFilters() {
        log.debug("Getting available tool filters");
        return toolService.getToolFilters();
    }
} 