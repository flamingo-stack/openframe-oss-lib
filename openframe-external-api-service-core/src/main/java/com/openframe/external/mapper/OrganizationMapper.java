package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationResponse;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.data.document.organization.Organization;
import com.openframe.external.dto.organization.OrganizationsResponse;
import com.openframe.external.dto.shared.SortCriteria;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Mapper for organization-related REST API DTOs.
 * Extends BaseRestMapper for pagination support.
 */
@Component("externalOrganizationMapper")
public class OrganizationMapper extends BaseRestMapper {

    private final com.openframe.api.mapper.OrganizationMapper sharedMapper;

    public OrganizationMapper(com.openframe.api.mapper.OrganizationMapper sharedMapper) {
        this.sharedMapper = sharedMapper;
    }

    public OrganizationResponse toResponse(Organization organization) {
        return sharedMapper.toResponse(organization);
    }

    public OrganizationFilterOptions toFilterOptions(String category, Integer minEmployees, 
                                                     Integer maxEmployees, Boolean hasActiveContract) {
        return OrganizationFilterOptions.builder()
                .category(category)
                .minEmployees(minEmployees)
                .maxEmployees(maxEmployees)
                .hasActiveContract(hasActiveContract)
                .build();
    }

    public SortInput toSortInput(SortCriteria criteria) {
        if (criteria == null) {
            return null;
        }
        
        SortInput sortInput = new SortInput();
        sortInput.setField(criteria.getField());
        sortInput.setDirection(SortDirection.ASC.name().equalsIgnoreCase(criteria.getDirection()) ? 
            SortDirection.ASC : SortDirection.DESC);
        
        return sortInput;
    }

    public OrganizationsResponse toOrganizationsResponse(CountedGenericQueryResult<Organization> queryResult) {
        List<OrganizationResponse> organizationResponses = queryResult.getItems().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return OrganizationsResponse.builder()
                .organizations(organizationResponses)
                .total(organizationResponses.size())
                .hasNextPage(queryResult.getPageInfo().isHasNextPage())
                .hasPreviousPage(queryResult.getPageInfo().isHasPreviousPage())
                .startCursor(queryResult.getPageInfo().getStartCursor())
                .endCursor(queryResult.getPageInfo().getEndCursor())
                .build();
    }
}