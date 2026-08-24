package com.openframe.api.dto.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for contact information including contacts and addresses.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactInformationDto {
    private List<ContactPersonDto> contacts;
    private AddressDto physicalAddress;
    private AddressDto mailingAddress;
    private Boolean mailingAddressSameAsPhysical;
}
