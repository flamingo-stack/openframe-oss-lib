package com.openframe.api.dto.organization;

import lombok.Builder;

/**
 * DTO for address information.
 */
@Builder
public record AddressDto(
        String street1,
        String street2,
        String city,
        String state,
        String postalCode,
        String country
) {
}
