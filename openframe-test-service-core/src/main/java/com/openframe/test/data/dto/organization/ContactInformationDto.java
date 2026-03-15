package com.openframe.test.data.dto.organization;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for contact information including contacts and addresses.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ContactInformationDto {
        List<ContactPersonDto> contacts;
        AddressDto physicalAddress;
        AddressDto mailingAddress;
        Boolean mailingAddressSameAsPhysical;
}

