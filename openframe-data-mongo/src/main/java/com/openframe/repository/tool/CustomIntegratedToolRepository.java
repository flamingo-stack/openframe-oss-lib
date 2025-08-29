package com.openframe.repository.tool;

import com.openframe.document.tool.IntegratedTool;
import com.openframe.document.tool.filter.ToolQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

public interface CustomIntegratedToolRepository {
    Query buildToolQuery(ToolQueryFilter filter, String search);

    List<IntegratedTool> findToolsWithFilters(ToolQueryFilter filter, String search);

    List<String> findDistinctTypes();

    List<String> findDistinctCategories();

    List<String> findDistinctPlatformCategories();
}