package com.openframe.api.service;

import com.openframe.api.dto.tool.ToolFilterCriteria;
import com.openframe.api.dto.tool.ToolFilters;
import com.openframe.api.dto.tool.ToolList;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.filter.ToolQueryFilter;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ToolService {
    
    private final IntegratedToolRepository integratedToolRepository;

    public Optional<IntegratedTool> findById(String id) {
        log.debug("Finding integrated tool by ID: {}", id);
        return integratedToolRepository.findById(id);
    }

    public ToolList queryTools(ToolFilterCriteria filterOptions, String search, SortInput sort) {
        log.debug("Querying tools with filter: {}, search: {}, sort: {}", filterOptions, search, sort);
        
        ToolQueryFilter queryFilter = buildQueryFilter(filterOptions);
        
        String sortField = validateSortField(sort != null ? sort.getField() : null);
        SortDirection sortDirection = (sort != null && sort.getDirection() != null) ? 
            sort.getDirection() : SortDirection.ASC;
        
        List<IntegratedTool> tools = integratedToolRepository.findToolsWithFiltersAndSort(
            queryFilter, search, sortField, sortDirection.name());
        
        return ToolList.builder()
                .tools(tools)
                .build();
    }

    public ToolFilters getToolFilters() {
        log.debug("Getting available tool filters");
        
        List<String> types = integratedToolRepository.findDistinctTypes();
        List<String> categories = integratedToolRepository.findDistinctCategories();
        List<String> platformCategories = integratedToolRepository.findDistinctPlatformCategories();
        
        return ToolFilters.builder()
                .types(types)
                .categories(categories)
                .platformCategories(platformCategories)
                .build();
    }
    
    private ToolQueryFilter buildQueryFilter(ToolFilterCriteria filterOptions) {
        if (filterOptions == null) {
            return ToolQueryFilter.builder().build();
        }
        
        return ToolQueryFilter.builder()
                .enabled(filterOptions.getEnabled())
                .type(filterOptions.getType())
                .category(filterOptions.getCategory())
                .platformCategory(filterOptions.getPlatformCategory())
                .build();
    }
    
    private String validateSortField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return integratedToolRepository.getDefaultSortField();
        }
        String trimmedField = field.trim();
        if (!integratedToolRepository.isSortableField(trimmedField)) {
            log.warn("Invalid sort field requested for tools: {}, using default", field);
            return integratedToolRepository.getDefaultSortField();
        }
        return trimmedField;
    }
} 