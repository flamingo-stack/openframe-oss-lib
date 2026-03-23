package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.OrganizationResponse;
import com.openframe.data.document.organization.Organization;
import com.openframe.external.dto.organization.OrganizationsResponse;
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

    public OrganizationsResponse toOrganizationsResponse(CountedGenericQueryResult<Organization> queryResult) {
        List<OrganizationResponse> organizationResponses = queryResult.getItems().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return OrganizationsResponse.builder()
                .organizations(organizationResponses)
                .total(organizationResponses.size())
                .pageInfo(queryResult.getPageInfo())
                .build();
    }
}