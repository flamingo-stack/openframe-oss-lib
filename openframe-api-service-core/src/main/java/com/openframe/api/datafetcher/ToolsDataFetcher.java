package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import com.openframe.api.dto.tool.ToolFilterInput;
import com.openframe.api.dto.tool.ToolFilterCriteria;
import com.openframe.api.dto.tool.ToolFilters;
import com.openframe.api.dto.tool.ToolList;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLToolMapper;
import com.openframe.api.service.ToolService;
import com.openframe.audit.Audited;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import static com.openframe.data.document.audit.AuditAction.TOOL_CREDENTIALS_VIEW;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ToolsDataFetcher {

    private final ToolService toolService;
    private final GraphQLToolMapper toolMapper;

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
    @Audited(action = TOOL_CREDENTIALS_VIEW, targetId = "#dfe.source.id")
    public ToolCredentials credentials(DgsDataFetchingEnvironment dfe) {
        IntegratedTool tool = dfe.getSource();
        return tool.getCredentials();
    }

    @DgsQuery
    public ToolFilters toolFilters() {
        log.debug("Getting available tool filters");
        return toolService.getToolFilters();
    }
} 