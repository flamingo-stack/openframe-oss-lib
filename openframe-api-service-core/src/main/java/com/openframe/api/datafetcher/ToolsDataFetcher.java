package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.relay.Relay;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.api.dto.tool.ToolFilterInput;
import com.openframe.api.dto.tool.ToolFilterCriteria;
import com.openframe.api.dto.tool.ToolFilters;
import com.openframe.api.dto.tool.ToolList;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLToolMapper;
import com.openframe.api.service.ToolService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ToolsDataFetcher {

    private static final Relay RELAY = new Relay();

    private final ToolService toolService;
    private final GraphQLToolMapper toolMapper;

    @DgsData(parentType = "IntegratedTool", field = "id")
    public String toolNodeId(DgsDataFetchingEnvironment dfe) {
        IntegratedTool tool = dfe.getSource();
        return RELAY.toGlobalId("IntegratedTool", tool.getKey());
    }

    @DgsQuery
    public ToolList integratedTools(
            @InputArgument @Valid ToolFilterInput filter,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort) {

        log.debug("Getting integrated tools with filter: {}, search: {}, sort: {}", filter, search, sort);

        ToolFilterCriteria filterOptions = toolMapper.toToolFilterCriteria(filter);
        return toolService.queryTools(filterOptions, search, sort);
    }

    @DgsQuery
    public ToolFilters toolFilters() {
        log.debug("Getting available tool filters");
        return toolService.getToolFilters();
    }
} 