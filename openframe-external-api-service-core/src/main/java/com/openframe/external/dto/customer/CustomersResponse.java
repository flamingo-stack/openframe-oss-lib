package com.openframe.external.dto.customer;

import com.openframe.api.dto.shared.PageInfo;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Paginated list of customers")
public class CustomersResponse {

    @Schema(description = "Customers on the current page")
    private List<CustomerResponse> customers;

    @Schema(description = "Total count of customers matching the filter")
    private Integer filteredCount;

    @Schema(description = "Pagination information")
    private PageInfo pageInfo;
}
