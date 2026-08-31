package com.openframe.external.controller;

import com.openframe.api.service.ToolService;
import com.openframe.api.dto.tool.ToolFilterCriteria;
import com.openframe.external.web.ApiCaller;
import com.openframe.external.dto.tool.ToolFilterResponse;
import com.openframe.external.dto.tool.ToolsResponse;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.external.mapper.ToolMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/v1/tools")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Tools", description = "Integrated tools management operations")
public class ToolController {

    private final ToolService toolService;
    private final ToolMapper toolMapper;

    @Operation(summary = "Get integrated tools", description = "Retrieve integrated tools with optional filtering")
    @GetMapping
    @ResponseStatus(OK)
    public ToolsResponse getTools(
            @Parameter(description = "Filter by enabled status")
            @RequestParam(required = false) Boolean enabled,
            @Parameter(description = "Filter by tool type")
            @RequestParam(required = false) String type,
            @Parameter(description = "Search in tool name and description")
            @RequestParam(required = false) String search,
            @Parameter(description = "Filter by category")
            @RequestParam(required = false) String category,
            @Parameter(description = "Filter by platform category")
            @RequestParam(required = false) String platformCategory,
            @Parameter(description = "Sort field (name, type, category, ...)")
            @RequestParam(required = false) String sortField,
            @Parameter(description = "Sort direction (ASC or DESC)")
            @RequestParam(defaultValue = "ASC") String sortDirection,
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Getting tools - enabled: {}, type: {}, search: {}, category: {}, platformCategory: {}, sortField: {}, sortDirection: {} - userId: {}, apiKeyId: {}", 
                enabled, type, search, category, platformCategory, sortField, sortDirection, caller.userId(), caller.apiKeyId());

        ToolFilterCriteria filterCriteria = ToolFilterCriteria.builder()
                .enabled(enabled)
                .type(type)
                .category(category)
                .platformCategory(platformCategory)
                .build();
        
        var result = toolService.queryTools(filterCriteria, search,
                                           SortInput.from(sortField, sortDirection));
        return toolMapper.toToolsResponse(result);
    }

    @Operation(summary = "Get tool filters", description = "Retrieve available filter options for tools")
    @GetMapping("/filters")
    @ResponseStatus(OK)
    public ToolFilterResponse getToolFilters(
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Getting tool filters - userId: {}, apiKeyId: {}", caller.userId(), caller.apiKeyId());

        var filters = toolService.getToolFilters();
        return toolMapper.toToolFilterResponse(filters);
    }
} 