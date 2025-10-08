package com.openframe.api.mapper;

import com.openframe.api.dto.organization.OrganizationFilterInput;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import org.springframework.stereotype.Component;

/**
 * Mapper for converting GraphQL organization inputs to internal DTOs.
 */
@Component
public class GraphQLOrganizationMapper {

    /**
     * Convert GraphQL filter input to internal filter options.
     */
    public OrganizationFilterOptions toFilterOptions(OrganizationFilterInput input) {
        if (input == null) {
            return null;
        }

        return OrganizationFilterOptions.builder()
                .category(input.getCategory())
                .minEmployees(input.getMinEmployees())
                .maxEmployees(input.getMaxEmployees())
                .hasActiveContract(input.getHasActiveContract())
                .build();
    }
}
