package com.openframe.api.mapper;

import com.openframe.api.dto.tool.ToolFilterInput;
import com.openframe.api.dto.tool.ToolFilterCriteria;
import org.springframework.stereotype.Component;

@Component
public class GraphQLToolMapper {

    public ToolFilterCriteria toToolFilterCriteria(ToolFilterInput input) {
        if (input == null) {
            return ToolFilterCriteria.builder().build();
        }

        return ToolFilterCriteria.builder()
                .enabled(input.getEnabled())
                .type(input.getType())
                .category(input.getCategory())
                .platformCategory(input.getPlatformCategory())
                .build();
    }
}