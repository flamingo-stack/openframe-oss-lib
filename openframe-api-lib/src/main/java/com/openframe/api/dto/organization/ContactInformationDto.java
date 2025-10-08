package com.openframe.api.dto.organization;

import lombok.Builder;

import java.util.List;

/**
 * DTO for contact information including contacts and addresses.
 */
@Builder
public record ContactInformationDto(
        List<ContactPersonDto> contacts,
        AddressDto physicalAddress,
        AddressDto mailingAddress,
        Boolean mailingAddressSameAsPhysical
) {
}
